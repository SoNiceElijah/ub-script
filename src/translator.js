const Pipeline = require('./pipeline');
const path = require('path');
const { goFromFile } = require('ub-script-parser');

const translator = new Pipeline("ubot translator");

////////////////////////////////////////////////////////////

function repack(arr) {
    let res = [];
    for(let i = arr.length - 1; i >= 0; --i) {
        res.push(arr[i]);
    }
    return res;
}

function pack(move, func) {
    return { move, func };
}

function result(func) {
    return pack(() => [], func);
}

function block(res, glob, be = true) {
    const tabs = be ? str_tabs(glob) : ' ';
    const vars = glob.ctx.allvars();
    glob.ctxdown();
    let sep = (be ? ';\n' : ' ') + tabs;
    let nn = be ? '\n' : '';
    const sabs = be ? str_tabs(glob) : '';
    const retval = res.pop();
    const vfiltered = vars.filter(v => !v.startsWith('&'));
    
    const vtext = vfiltered.length ? tabs + vfiltered.map(v => `let ${v}`).join(sep) + ';' + nn : '';
    const vbody = res.length ? tabs + res.join(sep) + ';' + nn : '';
    const vret = tabs + `return ${retval};` + nn; 
    
    return `{${nn}${vtext}${vbody}${vret}${sabs}}`;
}

function base_match(type, actual, args, glob) {

    if(!type || !type.decl || type.decl.name !== 'type') {
        throw new Error("Translation error");
    }

    const varmap = { };
    const valmap = { };
    const next = [];

    for(let i = 0; i < type.decl.args.length && i < args.length; ++i) {
        if(type.decl.args[i].type === 'otherwise' || args[i].type === 'otherwise') {
            continue;
        }
        if(args[i].type === 'call') {
            const type = glob.ctx.get(args[i].caller.value);
            if(!type || !type.decl || type.decl.name !== 'type') {
                throw new Error("Translation error");
            }
            const name = `$TMP_C_${i}`;
            glob.ctx.set(name, true);
            next.push({ name, type, args : args[i].args });
            varmap[type.decl.args[i].value] = name;
            continue;
        }
        if(args[i].type === 'varible') {
            varmap[type.decl.args[i].value] = args[i].value;
            continue;
        }
        const right = args[i].type === 'pattern' ? `"${args[i].value}"` : args[i].value; 
        valmap[type.decl.args[i].value] = right;
    }

    const conditions = [];
    const assignments = [];

    function collect(dict, prefix) {
        for(const key in dict) {
            const tkey = dict[key].type;
            const vkey = dict[key].value;
            if(tkey === 'asis') {
                let mkey = vkey;
                if (typeof vkey === 'string') mkey = '"' + vkey + '"';
                conditions.push(`${actual}${prefix}.${key} === ${mkey}`);
            }
            if(tkey === 'template') {
                if (valmap[vkey] !== undefined && valmap[vkey] !== null) {
                    conditions.push(`${actual}${prefix}.${key} === ${valmap[vkey]}`);
                    continue;
                }
                conditions.push(`(${actual}${prefix}.${key} !== null && ${actual}${prefix}.${key} !== undefined)`);
                if (varmap[vkey]) {
                    glob.ctx.set(varmap[vkey], `${actual}${prefix}.${key}`);
                    assignments.push(`${varmap[vkey]} = ${actual}${prefix}.${key}`);
                    if(varmap[vkey].startsWith('$TMP_C_')) {
                        for(const n of next) {
                            if(n.name === varmap[vkey]) {
                                n.actual = `${actual}${prefix}.${key}`;
                                break;
                            }
                        }
                    }
                }
            }
            if(tkey === 'dict') {
                conditions.push(`(${actual}${prefix}.${key} !== null && ${actual}${prefix}.${key} !== undefined)`);
                collect(dict[key].mem, `${prefix}.${key}`);
            }
        }
    }

    collect(type.body.mem, '');
    const tabs = str_tabs(glob);
    const tabs2 = str_tabs(glob, TAB_INS);

    return { conds : `${conditions.join('\n' + tabs2 + '&& ')}\n`, assigns : `${assignments.join(';\n' + tabs)}`, next };
}

function assign_match(type, actual, args, glob) {

    const tabs = str_tabs(glob);

    const { conds, next } = base_match(type, actual, args, glob);
    const textConds = `if (!(${conds}${tabs})) throw new Error("Pattern not matched [${type.decl.struct.value}]!")`;

    const texts = next.map(e => assign_match(e.type, e.actual, e.args, glob));
    const nextText = next.length ? `\n${tabs}${texts.join(';\n' + tabs)}` : ''
    return `${textConds};${nextText}`;
}

function cases_match(type, actual, args, glob) {

    const tabs = str_tabs(glob);
    let { conds, assigns, next } = base_match(type, actual, args, glob);
    for(const n of next) {
        const m = cases_match(n.type, n.actual, n.args, glob);
        conds += `\n${tabs}&& ` + m.conds;
        assigns += `;\n${tabs}` + m.assigns;
    }
    
    return { conds, assigns };
}

function make_args(args, glob) {
    let i = 0;
    let vars = [];
    let calls = [];
    for(const arg of args) {
        if(arg.type === 'varible') {
            vars.push(arg.value);
        } else if (arg.type === 'call') {
            const text = `$A_${i}`;
            vars.push(text);
            calls.push(assign_match(glob.ctx.get(arg.caller.value),text,arg.args,glob));
        } else if (arg.type === 'otherwise') {
            vars.push(`_$_otherwise_${i}`);
        } else {
            throw new Error("Interpret error!");
        }
        ++i;
    }
    return { calls, text :`(${vars.join(', ')})`};
}

const TAB_INS = 4;
function inct(glob) {
    const old = glob.ctx;
    glob.ctxup();
    const ctx = glob.ctx;
    let tabs = old.get('&ta');
    if(!tabs) {
        tabs = 0;
    }
    ctx.set('&ta', tabs + TAB_INS);
    ctx.set('&rval', 0);
}

function str_tabs(glob, offset = 0) {
    const tabs = glob.ctx.get('&ta') + offset;
    let res = "";
    let i = 0;
    while(i++ < tabs) res += ' ';
    return res;
}

////////////////////////////////////////////////////////////

stds();
function stds() {
    function concat(...args) {
        return `"" + ${args.join(' + ')}`;
    } 

    function list(...args) {
        return `[${args.join(', ')}]`;
    }

    function elist() {
        return `[]`;
    }

    function epack() {
        return `{}`;
    }

    function pack(...args) {
        if(args.length % 2 !== 0) {
            this.__error__ = `"Pack" wrong number of arguments: ${args.length}`;
            throw new Error("Translate error");
        }
        const fields = []
        for(let i = 0; i < args.length - 1; i += 2)
        {
            fields.push(`${args[i]} : ${args[i+1]}`);
        }
        return `{ ${fields.join(', ')} }`;
    }

    function get(obj, ...args) {
        if(args.length < 1) {
            this.__error__ = `"Set" args must be at least 2`;
            throw new Error("Translate error");
        }
        return `${obj}[${args.join('][')}]`;
    }

    function set(obj, ...args) {
        if(args.length < 2) {
            this.__error__ = `"Set" args must be at least 3`;
            throw new Error("Translate error");
        }
        const right = args.pop();
        return `${obj}[${args.join('][')}] = ${right}`;
    }

    function not(arg) {
        return `!${arg}`;
    }

    function has(obj, ...args) {
        let ret = `${check('$x')}`;
        let params = [];
        for(const a of args) {
            params.push(a);
            ret += ` && ${check(get('$x', ...params))}`;
        }
        return `(($x) => ${ret})(${obj})`;
    }

    function instance(x, ...args) {
        return `new ${x}(${args.join(', ')})`;
    }
    function check(x) {
        return `(($x) => $x === null || $x === undefined ? false : true )(${x})`;
    }
    function print(obj) {
        return `console.log(${obj})`
    }

    const stddefs = {
        list,
        pack,
        set,
        not,
        get,
        has,
        msgs : "",
        concat,
        print,
        elist,
        epack,
        'new' : instance,
        'is' : check
    };

    for(const def in stddefs) 
        translator.ctx(def, stddefs[def]);
}

////////////////////////////////////////////////////////////

translator.rule(
    "blocks", 
    (node) => {
        return pack(
        () => { 
            const funcs = node.filter((e) => e.header.value === ':fn' || e.header.value === ':main');
            const uses = node.filter((e) => e.header.value === ':use');
            const types = node.filter((e) => e.header.value === ':decl');
            const imports = node.filter((e) => e.header.value === ':import'); 

            return [...repack(funcs),  ...repack(imports), ...repack(types), ...repack(uses)];
        },
        (res) => {
            return res.join(';\n');
        });
    }
);

translator.rule(
    "block", 
    (node, glob) => { 
        return pack(() => {
            if(node.header.value === ':main' || node.header.value === ':fn') {
                inct(glob);
                glob.ctx.set('&args', make_args(node.decl.args, glob));
                return repack(node.body);
            }
            if(node.header.value === ':decl') {
                const tabs = glob.ctx.get('&ta');
                if(!tabs) {
                    glob.ctx.set('&ta', 0);
                }
                glob.ctx.set(node.decl.struct.value, node);;
            }
            return [];
        },
        (res) => {
            if(node.header.value === ':main' || node.header.value === ':fn') {
                const name = node.decl.name.value;
                const postfix = node.header.value === ':main' ? `\nmodule.exports = ${name};` : '';
                const { calls, text } = glob.ctx.get('&args');
                return `function ${name}${text} ${block([ ...calls ,...res], glob)}${postfix}`;
            }
            if(node.header.value === ':decl') {
                const tabs = str_tabs(glob);
                const tabs2 = str_tabs(glob, TAB_INS);
                
                const args = node.decl.args.map(x => x.value);
                function unpack(dict) {
                    const res = [];
                    for(const key in dict) {
                        if(dict[key].type === 'asis') {
                            let right = dict[key].value;
                            if(typeof right === 'string') right = `"${right}"`;
                            res.push(`${key} : ${right}`);
                        }
                        if(dict[key].type === 'template') {
                            if(!args.includes(dict[key].value))
                                throw new Error("Translate error!");
                            res.push(`${key} : ${dict[key].value}`)
                        }
                        if(dict[key].type === 'dict') {
                            res.push(unpack.dict[key].mem);
                        }
                    }
                    return `{ ${res.join(', ')} }`;
                }
                return `function ${node.decl.struct.value}(${args.join(', ')}) {\n${tabs2}return ${unpack(node.body.mem)};\n${tabs}}`;
            }
        });
    }
);

translator.rule(
    "block_decl", 
    (node, glob) => {
        let oldfile;
        return pack(
            () => {
                if(node.header.value === ':use') {
                    
                    const file = glob.ctx.get('&file');
                    const modules = glob.ctx.get('&uses');
                    oldfile = file;

                    const name = node.decl.value;
                    let modulePath;
                    if(name.startsWith('.')) {
                        const dir = path.dirname(file);
                        modulePath = path.resolve(dir, name);
                    } else {
                        modulePath = path.resolve(__dirname, '..', 'stdlib', name);
                    }
                    if(!modulePath.endsWith('.ubot')) modulePath += '.ubot';
                    if(modules.includes(modulePath)) return null;
                    modules.push(modulePath);

                    console.time(`With ${modulePath}`);
                    const model = goFromFile(modulePath, {});
                    console.timeEnd(`With ${modulePath}`);

                    if(!model.valid()) {
                        ctx.crush(`Parse error ${modulePath}`);
                        throw new Error("Translation error!");
                    }

                    glob.ctx.set('&file', modulePath);
                    return [model.get()];
                }
                return [];
            },
            (res) => {
                if(node.header.value === ':import') {
                    return `const ${node.decl.to.value} = require('${node.decl.from.value}')`;
                }
                if(node.header.value === ':use') {
                    glob.ctx.set('&file', oldfile);
                    return res;
                }
                return "";
            }
    )}
);

const R_VAL = '$rvalue_';
translator.rule(
    "assignment", 
    (node, glob) => pack(
        () => [node.right],
        ([res]) => {
            let rval = glob.ctx.get('&rval');
            let right = '';
            if(node.right.type !== 'assignment') {
                glob.ctx.set('&rval', rval + 1);
                ++rval;
                glob.ctx.set(`${R_VAL}${rval}`, true);
                right = `${R_VAL}${rval} = `;
            }
            const tabs = str_tabs(glob);
            if(!glob.ctx.get(node.left.value) || typeof glob.ctx.get(node.left.value) === 'function') {
                if(node.left.type === 'varible') {
                    glob.ctx.set(node.left.value, true);
                }
            }
            let left;
            if(node.left.type === 'varible') {
                left = `${node.left.value} = ${R_VAL}${rval}`;
            } else {
                const type = glob.ctx.get(node.left.caller.value);
                if(!type || !type.decl || type.decl.name !== 'type') {
                    throw new Error("Translation error");
                }
                left = assign_match(type, `${R_VAL}${rval}`, node.left.args, glob);
            }
            
            return `${right}${res};\n${tabs}${left}`;
        }
    )
);

translator.rule(
    "binop", 
    (node) => pack(
        () => [node.left, node.right],
        ([right, left]) => {
            if(node.op === '+') return `(${left} + ${right})`;
            if(node.op === '-') return `(${left} - ${right})`;
            if(node.op === '*') return `(${left} * ${right})`;
            if(node.op === '/') return `(${left} / ${right})`;
            if(node.op === '<') return `(${left} < ${right})`;
            if(node.op === '>') return `(${left} > ${right})`;
            if(node.op === '<=') return `(${left} <= ${right})`;
            if(node.op === '>=') return `(${left} >= ${right})`;
            if(node.op === '==') return `(${left} === ${right})`;
            if(node.op === '&&') return `(${left} && ${right})`;
            if(node.op === '||') return `(${left} || ${right})`;
        }
    )
);

translator.rule(
    "literal", 
    (node) => result(
        () => `${node.value}`
    )
);

translator.rule(
    "varible", 
    (node, glob) => result(
        () => {
            const text = glob.ctx.get(node.value);
            if(typeof text === 'string') 
                return text;
            return `${node.value}`;
        }
    )
);

translator.rule(
    "boolean", 
    (node) => result(
        () => `${node.value}`
    )
);

translator.rule(
    "pattern", 
    (node) => result(
        () => `"${node.value}"`
    )
);

translator.rule(
    "otherwise", 
    (node) => result(
        () => `null`
    )
);

translator.rule(
    "call",
    (node, glob) => pack(
        () => {
            const arr = [ ...node.args, node.caller ];
            return repack(arr);
        },
        (res) => {
            const caller = res.pop();
            if(node.caller.type === 'varible') {
                const func = glob.ctx.get(caller);
                if(func && typeof func === 'function') {
                    return func(...res);
                }
            }
            if(node.args.length === 1 && node.args[0].type === 'otherwise') res = [];
            return `${caller}(${res.join(', ')})`;
        }
    )
);

translator.rule(
    "lambda",
    (node, glob) => pack(
        () => {
            inct(glob);
            glob.ctx.set('&args', make_args(node.decl.args, glob));
            return repack(node.body);
        },
        (res) => {
            const { calls ,text } = glob.ctx.get('&args');
            return `${text} => ${block([ ...calls, ...res], glob)}`;
        }
    )
);

translator.rule(
    "match",
    (node, glob) => pack(
        () => {
            inct(glob);
            glob.ctx.set('$match', true);
            glob.ctx.set('$right', true);
            glob.ctx.set('&last', false);
            return repack([node.by, ...node.cases]);
        },
        (res) => {
            const by = res.shift();
            const lt = str_tabs(glob);
            const lt2 = str_tabs(glob, TAB_INS);
            const last = glob.ctx.get('&last');
            glob.ctxdown();
            const st = str_tabs(glob);
            const st2 = str_tabs(glob, TAB_INS);
            if(!last) {
                res.push(`{\n${lt2}throw new Error("Value not matched!")\n${st2}}`);
            }
            return `(($match) => {\n${lt}${res.join(' else ')}\n${st}})(${by})`;
        }
    )
);

translator.rule(
    "case",
    (node, glob) => pack(
        () => {
            if(glob.ctx.get('&last')) return null;
            inct(glob);
            let type;
            if(node.value.type === 'call' && (type = glob.ctx.get(node.value.caller.value)) && type.decl && type.decl.name === 'type') {
                const { conds } = cases_match(type, '$match', node.value.args, glob);
                glob.ctx.set('&type_case', conds);
            }
            return repack([node.value, ...node.actions,]);
        },
        (res) => {
            const right = res.shift();
            if(node.value.type === 'otherwise') {
                const text = block(res, glob);
                glob.ctx.set('&last', true);
                return text;
            }
            let type_case =  glob.ctx.get('&type_case');
            if(type_case) {
                const text = block(res, glob);
                const tabs = str_tabs(glob);
                return `if (${type_case}${tabs}) ${text}`;
            }
            if(node.value.type === 'call' && node.value.caller === 'varible') {
                const left = glob.ctx.get(node.value.caller.value);
                if(left && typeof left === 'function') {
                    return `if (${left('$match')}) ${block(res, glob)}`;
                }
            }
            if(node.value.type === 'varible') {
                const left = glob.ctx.get(node.value.value);
                if(left && typeof left === 'function') {
                    return `if (${left('$match')}) ${block(res, glob)}`;
                }
            }
            return `if (($right = ${right}) && (((typeof $right === 'function') && $right($match)) || $match === $right)) ${block(res, glob)}`;
        }
    )
);

module.exports = translator;
