export const FUNCTIONS = [
  'count',
  'covariance',
  'cumulativeSum',
  'derivative',
  'difference',
  'distinct',
  'filter',
  'first',
  'from',
  'group',
  'integral',
  'join',
  'last',
  'limit',
  'map',
  'max',
  'mean',
  'min',
  'percentile',
  'range',
  'sample',
  'set',
  'shift',
  'skew',
  'sort',
  'spread',
  'stateTracking',
  'stddev',
  'sum',
  'window',
  'yield',
];

const tokenizer = {
  comment: {
    pattern: /(^|[^\\:])\/\/.*/,
    lookbehind: true,
    greedy: true,
  },
  'context-short': {
    pattern: /^\w+\.\.(\w+\.\.)?\w*$/i,
    alias: 'symbol',
    inside: {
      'short-root': /^\w+(?=\.\.)/,
      'short-delimiter': /\.\./,
      'short-field': /\w+$/,
      // 'short-measurement': {
      //   pattern: /\.\.\w+\.\./,
      // },
    },
  },
  'function-context': {
    pattern: /[a-z0-9_]+\(.*?\)/i,
    inside: {},
  },
  duration: {
    pattern: /-?\d+(ns|u|µ|ms|s|m|h|d|w)/i,
    alias: 'number',
  },
  builtin: new RegExp(`\\b(?:${FUNCTIONS.join('|')})(?=\\s*\\()`, 'i'),
  string: {
    pattern: /(["'])(?:\\(?:\r\n|[\s\S])|(?!\1)[^\\\r\n])*\1/,
    greedy: true,
  },
  keyword: /\b(?:and|empty|import|in|not|or|return)\b/,
  boolean: /\b(?:true|false)\b/,
  number: /\b0x[\da-f]+\b|(?:\b\d+\.?\d*|\B\.\d+)(?:e[+-]?\d+)?/i,
  operator: /-|\+|\*|\/|%|==|<=?|>=?|!=|!~|=~|=|<-|\|>/,
  punctuation: /[{}[\];(),.:]/,
};

tokenizer['function-context'].inside = {
  argument: {
    pattern: /[a-z0-9_]+(?=:)/i,
    alias: 'symbol',
  },
  duration: tokenizer.duration,
  number: tokenizer.number,
  builtin: tokenizer.builtin,
  string: tokenizer.string,
};

export default tokenizer;
