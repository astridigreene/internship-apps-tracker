// Parser checks for the NeetCode tab. Run: npm run test:neetcode (Node 22.18+ runs .ts directly).
import assert from 'node:assert/strict'
import { buildNeetCodeData, toIsoDate, NeetCodeSetupError, parseChecklist } from '../src/lib/neetcodeParse.ts'

assert.equal(toIsoDate(46324), '2026-10-29')
assert.equal(toIsoDate('Thu Oct 29, 2026'), '2026-10-29')
assert.equal(toIsoDate(''), null)
assert.equal(toIsoDate('add days'), null)

const header = ['#', 'Problem', 'Category', 'Diff', 'Min', 'Done (check or type x)', 'Original deadline', 'Planned date (auto)', 'Status (auto)', 'Cum undone min (helper)']
const checklist = [
  header,
  [1, 'Contains Duplicate', 'Arrays & Hashing', 'E', 15, true, 46324, '', 'Done', 0],
  [2, 'Valid Anagram', 'Arrays & Hashing', 'E', 15, 'x', 46324, '', 'Done', 0],
  [3, 'Two Sum', 'Arrays & Hashing', 'E', 15, false, 46324, 46324, 'On track', 15],
  [4, 'Group Anagrams', 'Arrays & Hashing', 'M', 30, '', 46328, 46330, 'Behind +2 d', 45],
  [5, 'Top K Frequent Elements', 'Arrays & Hashing', 'M', 30, false, 46329, 46325, 'Ahead 4 d', 75],
  [6, 'Trapping Rain Water', 'Two Pointers', 'H', 45, false, 46340, '', 'Needs more time', 120],
  [7, 'Valid Palindrome', 'Two Pointers', 'E', 15, false, 46340, ''],
  [],
  ['', '', '', '', '', '', '', '', '', ''],
]
const nextUp = [
  ['NeetCode: what to do next'],
  [],
  ['Next study day', 46324],
  ['Following study day', 46328],
  [],
  ['Do on next study day', '', 'Do on following study day'],
  ['Two Sum (E)', '', 'Group Anagrams (M)'],
  ['Mystery Problem (H)'],
  [], [],
  ['Progress'],
  ['Done', 2],
  ['Remaining', 5],
  ['Remaining minutes', 150],
  ['Original finish deadline', 46456],
  ['Projected finish (auto)', 46460],
  ['Problems behind schedule', 1],
  ['Extra minutes needed before deadline', 60],
  ['...i.e. extra min per study day', 3.5],
  [],
  ['How it works: check a problem…'],
]

const data = buildNeetCodeData(checklist, nextUp)
assert.equal(data.problems.length, 7)
assert.equal(data.doneColumn, 'F')
const [p1, p2, p3, p4, p5, p6, p7] = data.problems
assert.equal(p1.sheetRow, 2)
assert.equal(p7.sheetRow, 8)
assert.deepEqual([p1.done, p1.doneIsCheckbox, p2.done, p2.doneIsCheckbox, p3.done, p3.doneIsCheckbox, p4.done], [true, true, true, false, false, true, false])
assert.deepEqual(data.problems.map((p) => p.statusKind), ['done', 'done', 'onTrack', 'behind', 'ahead', 'needsTime', 'noSlot'])
assert.equal(p4.plannedDate, '2026-11-04')
assert.equal(p6.plannedDate, null)
assert.equal(p6.difficulty, 'H')
assert.equal(p5.minutes, 30)

const [next, following] = data.nextDays
assert.equal(next.date, '2026-10-29')
assert.equal(following.date, '2026-11-02')
assert.deepEqual(next.problems.map((x) => [x.label, x.problem?.sheetRow ?? null]), [['Two Sum (E)', 4], ['Mystery Problem (H)', null]])
assert.deepEqual(following.problems.map((x) => x.problem?.name), ['Group Anagrams'])

assert.deepEqual(data.progress, {
  done: 2, total: 7, remaining: 5, remainingMinutes: 150,
  originalFinish: '2027-03-10', projectedFinish: '2027-03-14', projectedFinishLabel: '46460',
  problemsBehind: 1, extraMinutesNeeded: 60, extraMinutesPerStudyDay: 3.5,
})

// No Next Up tab / empty → still works with checklist-derived counts.
const bare = buildNeetCodeData(checklist, null)
assert.equal(bare.progress.done, 2)
assert.equal(bare.nextDays[0].date, null)

// No-slot message instead of a date.
const noSlot = buildNeetCodeData(checklist, [['Next study day', 'Add days to Capacity'], ['Following study day', '']])
assert.equal(noSlot.nextDays[0].date, null)
assert.equal(noSlot.nextDays[0].label, 'Add days to Capacity')

// Setup errors.
assert.throws(() => parseChecklist([]), NeetCodeSetupError)
assert.throws(() => parseChecklist([['#', 'Problem', 'Category']]), (e: unknown) => e instanceof NeetCodeSetupError && e.missing.includes('done'))

console.log('all parser checks passed')
