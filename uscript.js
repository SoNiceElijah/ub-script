#! /usr/bin/env node

const argsParser = require('args-parser');
const { goFromFile } = require('ub-script-parser');
const translator = require('./src/translator');
const path = require('path');
const fs = require('fs');
const package = require('./package.json');

function printErr(error) {
    
    if(error.node) {

        const { factory } = this.getMeta();
        const node = error.node;
        const record = factory.map[node.lex_token.from];
        const file = this.getMeta().file || "";

        console.log();

        const { res, left } = factory.getFromSourceLine(record.pos);
        console.log(`${record.line}| ${res}`);
        let spaces = "";
        let i = 0;
        while(i < left + record.line.toFixed(0).length + 1) {
            spaces += ' ';
            ++i;
        }
        console.log(spaces + '^');
        if(error.err) {
            console.log(`\x1b[31m${error.err}\x1b[0m`);
        } else {
            console.log(`\x1b[93m${error.warn}\x1b[0m`);
        }
        console.log(`File: ${file}:${record.line}:${record.col}\n`);
    } else {
        console.log(error);
    }
}

function build() {
    console.log(`\x1b[33mUB v${0.8}\x1b[0m`);
    const config = path.resolve(process.cwd(),'ubot.json');
    if(!fs.existsSync(config)) {
        return console.log("\x1b[31mError!\x1b[0m ubot.json not found")
    }
    const settings = JSON.parse(fs.readFileSync(config,'utf-8'));
    if(!settings) {
        return console.log("\x1b[31mError!\x1b[0m error while reading ubot.json")
    }

    const exc = settings.exclude || [];
    const excludes = exc.map(e => path.resolve(process.cwd(), e));
    excludes.push()

    const extensions = settings.extensions || [];

    const files = [];
    const copy = [];

    function collect(dir, to) {
        if(!fs.existsSync(dir)) {
            return;
        }
        if(excludes.includes(dir)) {
            return;
        }
        const dirfs = fs.readdirSync(dir);
        for(const f of dirfs) {
            const fp = path.resolve(dir, f);
            const ft = path.resolve(to, f);
            if(fs.lstatSync(fp).isDirectory()) {
                collect(fp, ft);
            } else if(f.endsWith('.ubot') && !excludes.includes(fp)) {
                files.push({ from : fp, to : path.resolve(to, path.basename(f, '.ubot')) + '.js' });
            } else if(extensions.includes(path.extname(f))) {
                copy.push({ from : fp, to : ft });
            }
        }
    }

    const outdir = settings.outdir || '';
    collect(process.cwd(), path.resolve(process.cwd(), outdir));

    let status = 0;
    for(const f of files) {
        const todir = path.dirname(f.to);
        if(!fs.existsSync(todir))
            fs.mkdirSync(todir, { recursive : true });
        status = status | compile(f.from, f.to);
    }

    for(const c of copy) {
        const todir = path.dirname(c.to);
        if(!fs.existsSync(todir))
            fs.mkdirSync(todir, { recursive : true });
        fs.copyFileSync(c.from, c.to);
    }

    if(settings.jsmain && settings.main) {
        let smain = path.resolve(process.cwd(), settings.outdir || '', settings.main);
        if(smain.endsWith('.ubot')) { 
            smain = smain.substring(0,smain.length - 4) + 'js'
        }
        const pmain = path.resolve(process.cwd(), settings.jsmain);
        const pdir= path.dirname(pmain);
        let req = path.relative(pdir, smain);
        if(!req.startsWith('.')) {
            req = './' + req;
        }
        if(!fs.existsSync(pdir)) {
            fs.mkdirSync(pdir, { recursive : true });
        }
        const text = `require('${req}')(process.argv);\n`;
        fs.writeFileSync(pmain, text, 'utf-8');
    }

    return status;
}

function compile(file, resultfile) {
    const filename = path.basename(file, '.ubot');

    console.time(`Parse ${file}`);
    const meta = { };
    let model = goFromFile(file, meta);
    console.timeEnd(`Parse ${file}`);

    model.iterateErrs(printErr);
    if(!model.valid()) return 1;

    console.time(`Translate ${file}`);
    const res = translator.run(model.get(), file);

    resultfile = resultfile || path.resolve(process.cwd(), filename + '.js');
    fs.writeFileSync(resultfile, res);
    console.timeEnd(`Translate ${file}`);
    console.log(`\x1b[32mTranslated\x1b[0m ${file} - into -> ${resultfile}`);

    return 0;
}

function init() {
    const dir = fs.readdirSync(process.cwd());
    const main = dir.find((e) => path.extname(e) === '.ubot') || '';
    const settings = {};
    
    settings.main = main;
    settings.outdir = 'build/';
    settings.exclude = ['build/', 'node_modules/'],
    settings.jsmain = 'index.js';
    settings.extensions = ['.txt', '.js'];
    settings.verison = package.version;

    fs.writeFileSync(path.resolve(process.cwd(), 'ubot.json'), JSON.stringify(settings, null, 4), 'utf-8');
}

main();
function main() {

    const args = argsParser(process.argv);

    if(args.init) {
        return init();
    }
    const comps = args.c || args.compile;
    if(comps) {
        console.log(`\x1b[33mUB v${0.8}\x1b[0m`);
        let status = 0;
        for(const f of comps.split(' ').filter(e => e.length).map(e => e.trim()))
            status = status | compile(f);
        return status;
    }
    if(args.build) {
        return build();
    }

}
