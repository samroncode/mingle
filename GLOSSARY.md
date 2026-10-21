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

**Party screen**:
What the TV shows when no activity is running: welcome message, join QR code, menu, schedule and the guests who have joined.
_Avoid_: Idle screen, home screen

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
Showing the results of a step to everyone. Before a reveal, only the host sees individual answers.

## Content

**Content**:
The questions, award categories and hot takes an activity uses, built in or written by the host.

**Draft**:
Content no host has approved yet, such as an AI suggestion. Only hosts can see drafts.

**Approved**:
Content a host has accepted. Only approved content reaches guests and the TV.

**Answer**:
A guest's response to a quiz question or a hot take.
_Avoid_: Response, submission

**Vote**:
A guest's choice of another guest in an award category.
_Avoid_: Nomination, pick
