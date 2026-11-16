import { withFriendsOrFamily } from '../metrics-calc'

const yes = [
  'Video games with friends', 'Dinner with family', 'Gym with a friend', 'gym with friends',
  'Lunch with my brother', 'Coffee with mom', 'Walk with my wife', 'Park with the kids',
  'Dinner w/ the fam', 'Brunch with my mother-in-law', 'Movie with my partner',
  'Gym with Thabo and his brother', 'Lunch with my team and my sister', 'Call with Mum',
  'Board games with friends, then bed', 'Family dinner', 'Dinner at mom\'s', 'Visited grandma',
  'Hangout with the boys', 'Friends night', 'Dinner at my sister\'s',
]
const no: (string | null | undefined)[] = [
  'Lunch with colleagues', 'Call with a client', 'Sync with my team', 'Gym with Thabo',
  'Gym without friends', 'Dinner without family', 'Worked within the family business hours',
  'Meeting with partners', 'Meeting with a partner', 'Friends episode', 'Family admin', 'Gym',
  '', null, undefined, 'Lunch with colleagues about family leave policy',
  'Call with Family Services', 'Meeting with the family law firm', 'Meeting at the family office',
]

describe('withFriendsOrFamily', () => {
  it.each(yes)('counts %s', (text) => expect(withFriendsOrFamily(text)).toBe(true))
  it.each(no)('does not count %s', (text) => expect(withFriendsOrFamily(text)).toBe(false))
})
