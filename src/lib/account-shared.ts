/**
 * The one thing the delete-account sheet and its route must agree on. It is
 * here, and not in the route or in account-data.ts, because the sheet runs
 * in the browser and those two must never be imported there.
 */

/** What the request must say. Nothing deletes an account by being called carelessly. */
export const DELETE_CONFIRMATION = 'delete my account'

/** What the person types. Short, because it is typed on a phone. */
export const DELETE_WORD = 'delete'
