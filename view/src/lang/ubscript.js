export default function _ubotscript(hljs) {
    const BUILTIN = "print get set pack list epack elist is new concat";
    const KEYWORD = ":fn :decl :main :import :use match";
    const LITERAL = "_ true false";
    const NUMBERS = hljs.inherit(hljs.NUMBER_MODE);
    const COMMENTS = hljs.inherit(hljs.HASH_COMMENT_MODE);
    const STRINGS = {
        className: 'string',
        begin: '"|\'',
        end: '"|\'',
        contains: [ { begin: '""' } ]
    };
    return {
        name: 'UBScript',
        case_insensitive: false,
        keywords: {
          $pattern : ':?[a-zA-Z]+\\b',
          keyword: KEYWORD,
          built_in: BUILTIN,
          literal: LITERAL
        },
        contains: [
          COMMENTS,
          NUMBERS,
          STRINGS,
        ]
      };
}
