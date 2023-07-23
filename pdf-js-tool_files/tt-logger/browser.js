{
const exp = {
    sre2pair(sre) {
        const a = sre.split('/')
        return [a.slice(1, -1).join('/'), a[a.length-1]]
    },
    pair2sre(s, flag = '') {
        return `/${s}/${flag}`
    },
    sre2re(sre) {
        const pair = this.sre2pair(sre)
        return new RegExp(pair[0], pair[1])
    }
}

exp.symbol = {
    lazy: Symbol('lazy-evaluate'),
    identity: Symbol('identity')
}

exp.bind = function rbind(x, ...args) {
    if (typeof x != 'function') x = this[x]
    return x.bind(this, ...args)
}

var TtLogger = class TtLogger {
    constructor() {
        this._constructor(...arguments)
    }
    _constructor() {
        this.levelDefault = 1
        this.levelOutput = 1
        this.keyMap = new Map()
        this.globMap = new Map()
    }
    logWrite(s) {
        console.log(s)
    }
    exclude(s, ...v) {
        return this.setTagStringLevel(s, v, this.levelOutput+1)
    }
    include(s, ...v) {
        return this.setTagStringLevel(s, v, this.levelOutput)
    }
    setTagStringLevel(s, v, level = this.levelDefault) {
        // ttLogger.exclude `argv file-write save`
        const join = exp.mergeTagString(s, v).join('')
        return join.split(/\s+/).map(t => {
            if (this.isGlob(t)) {
                return this.setLevelGlob(t, '', level)
            }
            else return this.setMapLevel('keyMap', t, level)
        })
    }
    isGlob(x) {
        return /[\[\]\.\|\*\+\?]/.test(x)
    }
    setLevelGlob(g, flag, level, opt = {}) {
        return this.setLevelSre(this.glob2sre(g, flag), level, opt)
    }
    setLevelSre(sre, level, opt = {}) {
        if (level == null) level = this.levelDefault
        const map = this.globMap
        const o = map.get(sre)
        if (!o) {
            const re = exp.sre2re(sre)
            map.set(sre, {re, level})
            return level
        }
        else if (level < o.level || opt.overwrite) {
            return o.level = level
        }
        else return null
    }
    glob2sre(g, flag = '') {
        return exp.pair2sre(this.glob2re(g), flag)
    }
    glob2re(g) {
        return `^(${g})$`
    }
    includeGlob(g, flag = '') {
        let r = this.glob2re(g)
        return this.setLevelGlob(exp.pair2sre(r, flag), this.levelOutput)
    }
    excludeGlob(g, flag = '') {
        let r = this.glob2re(g)
        return this.setLevelGlob(exp.pair2sre(r, flag), this.levelOutput+1)
    }
    setMapLevel(map, k, level = this.levelDefault, opt = {}) {
        if (typeof map == 'string') map = this[map]
        const o = map.get(k)
        if (!o) map.set(k, {level})
        else if (level < o.level || opt.overwrite)  o.level = level
        else return null
        return level
    }
    excludeTag(tag, level = this.levelOutput + 1) {
        return this.setMapLevel('keyMap', tag, level)
    }
    includeTag(tag, level = this.levelOutput) {
        return this.setMapLevel('keyMap', tag, level)
    }
    format(tag, m) {
        let o
        if (m.indexOf('\n') == -1) o = `[${tag}] ${m}`
        else o = `[${tag}]\n${m.trim()}\n[/${tag}]`
        return o
    }
    logt(s, ...v) {
        // if (v.every(x => typeof x != 'function')) {
        let head = s[0]
        let i
        for (i=0; i<v.length; i++) {
            if (exp.isObject(v[i])) break
            head += exp.xToString(v[i]) + s[i+1]
        }
        const scan = head.match(/^(.*?)\s/)
        if (!scan) throw new Error('tag not found')
        const tag = scan[1]
        const neck = head.slice(scan[0].length)
        const other = [neck].concat(s.slice(i+1))
        const vother = v.slice(i)
        return this.log(tag, () => exp.mergeTagString(other, vother).join(''))
    }
    log(tag, msg) {
        if (this.skip(tag)) return false
        const m = this.format(tag, exp.xToString(msg))
        this.logWrite(m)
        return true
    }
    matchTag(t) {
        for (const [sre, o] of this.globMap) {
            const re = o.re
            if (re.test(t)) return o
        }
        return null
    }
    skip(tag) {
        const map = this.keyMap
        const def = this.levelDefault
        const min = this.levelOutput
        if (!map.has(tag)) {
            const reo = this.matchTag(tag)
            let o
            if (!reo) o = {level: def}
            else o = {level: reo.level}
            map.set(tag, o)
            return o.level > min
        }
        else {
            const o = map.get(tag)
            return o.level > min
        }
    }
}
TtLogger.prototype.bind = exp.bind

var ttLogger = new TtLogger()
var log = ttLogger.bind('logt')

exp.xToString = function (x) {
    return String(this.unwrap(x))
}
exp.mergeTagString = function (s, v, map) {
    return [s[0]].concat(
        v.map((x, i) => [(map ? map(x) : this.xToString(x)), s[i+1]]).flat()
    )
}
exp.wrap = (x) => {
    return [exp.symbol.identity, x]
}
exp.unwrap = (x) => {
    if (typeof x == 'function') return x()
    if (Array.isArray(x) && x.length == 2 && x[0] == exp.symbol.identity) {
        return x[1]
    }
    return x
}
exp.isObject = x => {
    switch (typeof x) {
    case 'object':
    case 'function':
        return Boolean(x)
    default:
        return false
    }
}

TtLogger.exp = exp
}
// wrap like this?
// log `foo ${exp.wrap(()=>'lazy')}`
// log `foo l${()=>'lazy'}`
// logt `foo ${()=>'lazy'}`
// logl `foo` (() => 'lazy')
// logl('foo', () => 'lazy')

// exp.x2s

// todo
// deal empty string tag or some default
