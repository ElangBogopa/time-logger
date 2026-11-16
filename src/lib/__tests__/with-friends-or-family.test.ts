import { withFriendsOrFamily } from '../metrics-calc'

const yes = [
  'Video games with friends', 'Dinner with family', 'Gym with a friend', 'gym with friends',
  'Lunch with my brother', 'Coffee with mom', 'Walk with my wife', 'Park with the kids',
  'Dinner w/ the fam', 'Brunch with my mother-in-law', 'Movie with my partner',
  'Gym with Thabo and his brother', 'Lunch with my team and my sister', 'Call with Mum',
  'Board games with friends, then bed', 'Family dinner', 'Dinner at mom\'s', 'Visited grandma',
  'Hangout with the boys', 'Friends night', 'Dinner at my sister\'s',
  'Dinner with friends planning the trip', 'Dinner with friends practice night', 'Lunch at grandma',
  'Dinner at mom and dad\'s', 'Sunday lunch at my parents then nap', 'Dinner at grandma tonight',
  'Dinner at my parents\' house', 'Lunch at mom\'s for her birthday',
  // What may follow "at <people>" is anything but a venue (review 4).
  'Dinner at mom\'s 7pm', 'Dinner at mom\'s again', 'Dinner at mom\'s - fun', 'Dinner at mom\'s – lovely',
  'Dinner at grandma\'s 🎉', 'Lunch at mom\'s w grandpa', 'Lunch at my brother\'s new place',
  'BBQ at uncle\'s backyard', 'Weekend at grandma\'s cottage',
  'Braai at my cousin\'s', 'Sleepover at grandma\'s farm', 'Tea at my aunt\'s garden',
  'Christmas at the in-laws', 'Sunday roast at my mother-in-law\'s', 'Movie night at my girlfriend\'s apartment',
  'Dinner at mom\u2019s 6:30', 'Lunch at my sister\'s (so good)', 'Pool day at my uncle and aunt\'s',
  'Games at a friend\'s until late', 'Stayed at my parents\' all weekend', 'Dinner at dad\'s yesterday evening',
  'Watched the match at my brother\'s lol', 'Supper at granny\'s x', 'Lunch at mom\'s, then school run',
  'Dinner at mom\'s then work', 'Dinner at my friends\' new flat', 'Visiting my aunt', 'Saw my cousins',
]
const no: (string | null | undefined)[] = [
  'Lunch with colleagues', 'Call with a client', 'Sync with my team', 'Gym with Thabo',
  'Gym without friends', 'Dinner without family', 'Worked within the family business hours',
  'Meeting with partners', 'Meeting with a partner', 'Friends episode', 'Family admin', 'Gym',
  '', null, undefined, 'Lunch with colleagues about family leave policy',
  'Call with Family Services', 'Meeting with the family law firm', 'Meeting at the family office',
  'Parent-teacher meeting at the kids school', 'Coffee at Friends cafe', 'Appointment with family planning clinic',
  'Parent-teacher meeting at the kids\' school', 'Pickup at my son\'s school', 'Coffee at friends\' cafe',
  'Drop-off at my daughter\'s daycare', 'Meeting at the boys and girls club',
  'Pickup at my son\'s new school', 'Assembly at the kids\' primary school', 'Lunch at my wife\'s work',
  'Coffee at friends\' coffee shop', 'Waiting at my daughter\'s dance class', 'Pickup at my son\'s soccer practice',
  'Volunteering at the children\'s hospital', 'Haircut at my cousin\'s salon', 'Workout at my brother\'s gym',
  'Talk at my daughter\'s university', 'Fundraiser at the kids\' nursery', 'Drinks at the Three Sisters pub',
  'Checkup at the family clinic', 'Meeting at the parents association', 'Drop-off at the kids\' swimming lessons',
  'Shift at dad\'s shop', 'Pickup at my sons\' school 3pm', 'Dinner at home', 'Lunch at work with Thabo',
  'Gym with Thabo at his place', 'Standup at the office',
]

describe('withFriendsOrFamily', () => {
  it.each(yes)('counts %s', (text) => expect(withFriendsOrFamily(text)).toBe(true))
  it.each(no)('does not count %s', (text) => expect(withFriendsOrFamily(text)).toBe(false))
})
