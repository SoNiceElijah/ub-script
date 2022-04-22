function get(name, next, ...collections) {
    for(const c of collections) {
        if(c[name] !== undefined) {
            return c[name];
        }
    }
    if(!next)
        return undefined;
    return next(name);
}

class ContextFactory {
    constructor(vars) {
        this.vars = vars || {};

        this.get = this.get.bind(this);
        this.getType = this.getType.bind(this);
    }
    answer(val) {
        this.vars['__answer__'] = val;
    }
    error(val) {
        this.vars['__error__'] = val;
    }
    crush(msg) {
        this.vars['__error__'] = msg;
    }
    get(name) {
        return this.vars[name];
    }
    getType(name) {
        const type = this.vars[name];
        if(type && type.type === 'type') {
            return type;
        }
        return undefined;
    }
    set(name, val) {
        if(typeof val === 'function') val = val.bind(this);
        this.vars[name] = val;
    }
    fork() {
        return new Context(this, this, false);
    }
}

class Context {
    constructor(base, root, closed) {
        
        this.base = base;
        this.root = root;

        this.closed = closed;
        this.vars = {};

        this.get = this.get.bind(this);
        this.getType = this.getType.bind(this);
    }
    get(name) {
        let next = this.base;
        if(this.closed) next = this.root;
        return get(name, next.get, this.vars);
    }
    allvars() {
        const vars = [];
        for(const k in this.vars) {
            const type = this.vars[k];
            if(type && typeof type === 'function') {
                continue;
            }
            if(type && type.type === 'type') {
                continue;
            }
            if(type !== true) {
                continue;
            }
            vars.push(k);
        }
        return vars;
    }
    getType(name) {
        let next = this.base;
        if(this.closed) next = this.root;
        const type = get(name, next.getType, this.vars);
        if(type && type.type === 'type') {
            return type;
        }
        return undefined;
    }
    set(name, val) {
        if(name === undefined) throw Error("Well....");
        if(typeof val === 'function') val = val.bind(this.root);
        this.vars[name] = val;
    }
    answer(val) {
        this.root.answer(val);
    }
    crush(val) {
        this.root.error(val);
    } 
    error(val) {
        this.vars['__error__'] = val;
    }

    fork(closed = false) {
        return new Context(this, this.root, closed);
    }
}

module.exports = { ContextFactory, Context };
