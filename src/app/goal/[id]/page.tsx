import { redirect } from 'next/navigation'

/**
 * Goals were removed from the app. An old link or bookmark to a goal
 * lands on Today rather than on an error.
 */
export default function GoalPage() {
  redirect('/')
}
