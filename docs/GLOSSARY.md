# Mingle

Mingle runs one party evening: a host sets up an event, guests join from their phones, and a shared TV screen shows what's happening.

## People and screens

**Host**:
The person who creates and runs an event. Anyone who holds the host link is a host of that event.
_Avoid_: Admin, organizer, owner

**Guest**:
A person who has joined an event from their phone under a display name.
_Avoid_: Player, participant, user

**TV**:
A shared screen (a TV or laptop browser) that has joined an event to show it to the room.
_Avoid_: Display, big screen, projector

**Member**:
A host, guest or TV that belongs to a given event. Only members can see anything about an event.
_Avoid_: Participant, attendee

**Role**:
What a member is in an event: host, guest or TV.

**Display name**:
The only thing a guest tells Mingle about themselves: a short name, unique within the event.
_Avoid_: Username, nickname

## Events

**Event**:
One party evening, from creation until it expires.
_Avoid_: Party, session, room, game

**Code**:
The short code that identifies an event and lets guests and TVs join it.
_Avoid_: PIN, room code, event ID

**Admin key**:
The secret that proves someone is the host. It's shown to the host once, inside the host link.
_Avoid_: Password, token, host key

**Host link**:
The link to the host panel that carries the admin key.
_Avoid_: Admin link, secret link

**Claim**:
To become a host of an event by opening its host link on a device.

**Niche**:
The kind of evening (afterwork, team event, bachelor/bachelorette party), which sets the event's default activities, content and look.
_Avoid_: Theme, category, template

**Setup wizard**:
The short steps a host goes through to create an event, ending with its code and host link.
_Avoid_: Create flow, onboarding

**Party screen**:
What the TV shows when no activity is running: welcome message, join QR code, menu, schedule and the guests who have joined.
_Avoid_: Idle screen, home screen

**Control panel**:
The host's page for running the evening, opened from the host link: what the TV shows, the activities, the party screen, the guests and ending the evening.
_Avoid_: Host panel, admin page, dashboard

**Removed guest**:
A guest the host has taken out of the event. They no longer count as a member, can't read or do anything in the event and can't rejoin from the same phone.
_Avoid_: Kicked, banned, blocked

**Join panel**:
The part of the party screen that never rotates away: the join QR code, the code, the join address and how many guests have joined.
_Avoid_: Join box, sidebar

**Expiry**:
The moment an event stops existing for its members, 30 days after it was created.
_Avoid_: Retention, TTL

## Flow

**Activity**:
Something the host can run during an event: the quiz, awards or hot takes. Called a module in code.
_Avoid_: Game, round, mini-game

**Status**:
Where the event as a whole is: lobby (before it starts), live, or ended.

**Step**:
One question, category or hot take within the activity that's running.
_Avoid_: Round, slide, item

**Phase**:
Where the current step is: idle (not open yet), open (guests can answer) or revealed (results are shown).

**Reveal**:
Showing the results of a step to everyone. Before a reveal, only the host sees individual quiz answers. Award votes and hot take answers stay secret from everyone, the host included; only totals are shown.

## Content

**Content**:
The questions, award categories and hot takes an activity uses, built in or written by the host.

**Draft**:
Content no host has approved yet, such as an AI suggestion. Only hosts can see drafts.

**Approved**:
Content a host has accepted. Only approved content reaches guests and the TV.

**Quiz**:
The activity where guests answer multiple-choice questions and get a point for each right answer.

**Question**:
One step of the quiz: a text and four options, one of them the right answer.
_Avoid_: Item, card

**Option**:
One of the four answers a guest can pick for a question, shown as A to D.
_Avoid_: Choice, alternative

**Right answer**:
The option that gives a point. Only the host sees it before the reveal.
_Avoid_: Solution, correct option

**Played**:
A question, award category or hot take that has been revealed. Played steps can't be changed, and a restarted activity continues after them.

**Score**:
A guest's points in the quiz: one per right answer on played questions.
_Avoid_: Points total, result

**Awards**:
The activity where guests vote for another guest in "Most likely to…" categories, and the winner of each is revealed on the TV.
_Avoid_: Nominations, superlatives

**Category**:
One step of awards: a short text such as "Most likely to reply-all by mistake".
_Avoid_: Award (for the step), title

**Candidate**:
A guest with a display name who can be voted for in a category. Every guest except the voter.
_Avoid_: Nominee

**Winner**:
The guest or guests with the most votes in a revealed category. A tie gives several winners.
_Avoid_: Champion

**Hot takes**:
The activity where guests agree or disagree with short statements, and the split is revealed on the TV.
_Avoid_: Polls, opinions

**Hot take**:
One step of hot takes: a short statement of opinion such as "Pineapple belongs on pizza".
_Avoid_: Poll, question, statement (in code)

**Split**:
How a revealed hot take's answers divide between Agree and Disagree, shown as a percentage and count for each.
_Avoid_: Result, distribution

**Majority**:
The side of a hot take that got more answers. An exact 50/50 has no majority.

**Most divisive**:
The hot take whose split came closest to 50/50, shown at the end of hot takes.
_Avoid_: Most controversial

**Answer**:
A guest's response to a quiz question, or Agree or Disagree on a hot take.
_Avoid_: Response, submission

**Vote**:
A guest's choice of another guest in an award category.
_Avoid_: Nomination, pick
