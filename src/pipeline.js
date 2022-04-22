const { ContextFactory } = require('./context');

class Pipeline {
    constructor(name) {
        this.name = name;
        this.rules = {};

        this.basectx = {};
    }
    rule(type, action) {
        this.rules[type] = action;
    }
    ctx(name, val) {
        this.basectx[name] = val;
    }
    run(ast, file) {
    
        const State = function(base) {
            this.ctxroot = new ContextFactory({}, {}, {});
            for(const name in base) {
                this.ctxroot.set(name, base[name]);
            }
            this.ctxroot.set('&file', file);
            this.ctxroot.set('&uses', [file]);

            this.ctx = this.ctxroot;
            this.ctxup = function() {
                this.ctx = this.ctx.fork();
            }
            this.ctxdown = function() {
                if(!this.ctx.base)
                    throw new Error("Context down failed!");
                this.ctx = this.ctx.base;
            }
            return this;
        }

        const state = new State(this.basectx);
    
        const stack = [];
        const model = [];
        stack.push({ node : ast, up : false });
        while(stack.length > 0) {
            let { node, up } = stack[stack.length - 1];
            let type = node.type || node.lex_token.type;
            if(!up) {
                const top = stack[stack.length - 1];
                top.up = true;
                top.items = 0;
                const { move, func } = this.rules[type](node, state);
                top.func = func;
                const items = move();
                if(!items) {
                    model.push(null);
                    stack.pop();
                    continue;
                }
                for(const i of items) {
                    stack.push({node : i, up : false, func });
                    ++top.items;
                }
            } else {
                let record = stack.pop();
                const { func } = record;
                let tmp = [];
                let i = 0;
                while(i < record.items) {
                    ++i;
                    const item = model.pop();
                    if(item === null) continue;
                    tmp.push(item);
                }
                model.push(func(tmp.reverse()));
            }
        }
        return model[0];
    }
}

module.exports = Pipeline;
