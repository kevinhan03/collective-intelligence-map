// Revised Romanization for Korean place names that have no dictionary entry
// (e.g. "성수동" -> "Seongsu-dong"). Covers liaison and common nasalization only.
const initials = [
  "g",
  "kk",
  "n",
  "d",
  "tt",
  "r",
  "m",
  "b",
  "pp",
  "s",
  "ss",
  "",
  "j",
  "jj",
  "ch",
  "k",
  "t",
  "p",
  "h",
];
const vowels = [
  "a",
  "ae",
  "ya",
  "yae",
  "eo",
  "e",
  "yeo",
  "ye",
  "o",
  "wa",
  "wae",
  "oe",
  "yo",
  "u",
  "wo",
  "we",
  "wi",
  "yu",
  "eu",
  "ui",
  "i",
];
const finals = [
  "",
  "k",
  "k",
  "k",
  "n",
  "n",
  "n",
  "t",
  "l",
  "k",
  "m",
  "l",
  "l",
  "l",
  "p",
  "l",
  "m",
  "p",
  "p",
  "t",
  "t",
  "ng",
  "t",
  "t",
  "k",
  "t",
  "p",
  "t",
];
// A final consonant moves to the next syllable when that one starts with ㅇ
// (ㅇ itself stays as "ng").
const liaison = [
  "",
  "g",
  "kk",
  "ks",
  "n",
  "nj",
  "nh",
  "d",
  "r",
  "lg",
  "lm",
  "lb",
  "ls",
  "lt",
  "lp",
  "lh",
  "m",
  "b",
  "bs",
  "s",
  "ss",
  "",
  "j",
  "ch",
  "k",
  "t",
  "p",
  "h",
];
const suffixes: [string, string][] = [
  ["특별자치도", "-do"],
  ["특별자치시", ""],
  ["특별시", ""],
  ["광역시", ""],
  ["도", "-do"],
  ["시", "-si"],
  ["군", "-gun"],
  ["구", "-gu"],
  ["읍", "-eup"],
  ["면", "-myeon"],
  ["동", "-dong"],
  ["리", "-ri"],
  ["가", "-ga"],
];

function syllables(text: string) {
  let out = "";
  const codes = [...text].map((char) => char.charCodeAt(0) - 0xac00);
  codes.forEach((code, index) => {
    if (code < 0 || code > 11171) {
      out += String.fromCharCode(code + 0xac00);
      return;
    }
    const initial = Math.floor(code / 588);
    const vowel = Math.floor((code % 588) / 28);
    const final = code % 28;
    const prev = codes[index - 1];
    const prevFinal = prev >= 0 && prev <= 11171 ? prev % 28 : 0;
    let onset =
      initial === 11 && prevFinal ? liaison[prevFinal] : initials[initial];
    if (initial === 5 && (prevFinal === 4 || prevFinal === 8)) onset = "l";
    else if (initial === 5 && prevFinal) onset = "n";
    else if (initial === 2 && prevFinal === 8) onset = "l";
    const next = codes[index + 1];
    const nextInitial =
      next >= 0 && next <= 11171 ? Math.floor(next / 588) : -1;
    let coda = finals[final];
    if (final && nextInitial === 11) coda = final === 21 ? "ng" : "";
    else if (final === 4 && nextInitial === 5) coda = "l";
    else if (final && (nextInitial === 2 || nextInitial === 6))
      coda =
        coda === "k" ? "ng" : coda === "t" ? "n" : coda === "p" ? "m" : coda;
    out += onset + vowels[vowel] + coda;
  });
  return out;
}

export function romanizePlace(name: string) {
  if (!/[가-힣]/.test(name)) return name;
  const suffix = suffixes.find(
    ([ko]) => name.length > ko.length && name.endsWith(ko),
  );
  const stem = suffix ? name.slice(0, -suffix[0].length) : name;
  const roman = syllables(stem) + (suffix ? suffix[1] : "");
  return roman.charAt(0).toUpperCase() + roman.slice(1);
}
