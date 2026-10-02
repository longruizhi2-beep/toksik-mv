// Lyrics format. Copy this file to lyrics.js and fill in the song's timed lyrics
// (lyrics.js is git-ignored because song lyrics are copyrighted).
//
//   t      line start in seconds (from an .lrc file)
//   en     original line            zh    translation (second subtitle line)
//   kind   verse | chorus | shout | rap | cult   -> typography style
//   key    word that gets the big typographic hit; chorus keys also pick the tunnel variant:
//          CRAZY, OVER REACTIVE, PLAGUE, MELTDOWN, TURNING, NARCISSISTIC, SICK
//   echo   optional backing-vocal answer { en, zh }, shown one beat-snapped phrase later
//   quiet  optional, renders a chorus line in the calm verse style
window.TOKSIK_LYRICS = [
  { t: 1.648, en: 'First verse line', zh: '第一句主歌', kind: 'verse', key: 'VERSE' },
  { t: 33.993, en: 'A chorus line', zh: '一句副歌', echo: { en: 'Echo', zh: '回声' }, kind: 'chorus', key: 'CHORUS' },
  { t: 56.856, en: 'TokSik', zh: '毒音', kind: 'shout' },
];
