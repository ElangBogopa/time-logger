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
]
const no: (string | null | undefined)[] = [
  'Lunch with colleagues', 'Call with a client', 'Sync with my team', 'Gym with Thabo',
  'Gym without friends', 'Dinner without family', 'Worked within the family business hours',
  'Meeting with partners', 'Meeting with a partner', 'Friends episode', 'Family admin', 'Gym',
  '', null, undefined, 'Lunch with colleagues about family leave policy',
  'Call with Family Services', 'Meeting with the family law firm', 'Meeting at the family office',
  'Parent-teacher meeting at the kids school', 'Coffee at Friends cafe', 'Appointment with family planning clinic',
  'Parent-teacher meeting at the kids\' school', 'Pickup at my son\'s school', 'Coffee at friends\' cafe',
  'Drop-off at my daughter\'s daycare',
]

describe('withFriendsOrFamily', () => {
  it.each(yes)('counts %s', (text) => expect(withFriendsOrFamily(text)).toBe(true))
  it.each(no)('does not count %s', (text) => expect(withFriendsOrFamily(text)).toBe(false))
})
