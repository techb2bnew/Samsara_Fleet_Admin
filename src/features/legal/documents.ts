/**
 * The legal and support documents, as structured content.
 *
 * ---------------------------------------------------------------------------
 * Why not in constants/strings.ts
 * ---------------------------------------------------------------------------
 * Every other word in this console lives there, and these deliberately do not.
 * strings.ts is already 1,600 lines of interface copy — labels, hints, toasts —
 * and three legal documents would be longer than all of it put together. The
 * UI strings would be a minority in their own file.
 *
 * These are also a different KIND of text: a policy is a document with a date
 * on it that somebody outside this company may one day read closely, not a
 * label that gets reworded when a screen is redesigned.
 *
 * ---------------------------------------------------------------------------
 * What is NOT decided here
 * ---------------------------------------------------------------------------
 * Anything in [square brackets] is a business decision that code cannot make:
 * the company's legal name and address, how long records are kept, who data is
 * shared with beyond the processors already listed, and how a driver asks for
 * their data. Fill them in before this is published.
 *
 * The location and camera sections describe what the app actually does today,
 * read out of the code. Employee location tracking is regulated differently in
 * different places — this is worth a lawyer's eye before it goes live,
 * particularly if drivers ever work in the EU or UK.
 */

export type Section = {
  heading: string
  /** Paragraphs. A string starting with "- " is rendered as a bullet. */
  body: string[]
}

export type LegalDocument = {
  title: string
  /** Shown under the title, so a reader knows which version they are on. */
  updated: string
  intro: string
  sections: Section[]
}

/** Change this whenever a document below changes in substance. */
const UPDATED = '14 September 2026'

/*
 * The operator named in these documents, as given by the business.
 *
 * This is the data controller a reader — or a regulator — holds to what the
 * policy says, so it has to match the registration rather than a product name.
 * Worth re-checking against the Apple developer account, which is held under a
 * different entity.
 */
const COMPANY = 'B2B Campus'

/*
 * Verified from b2bcampus.com, and it matches the depot address already in the
 * console — so it is the right office even though the brand on that site is a
 * different business.
 */
const ADDRESS = 'F-209, Sector 74, Mohali, Punjab 160074, India'
const PHONE = '+91 98783 00209'

const CONTACT_EMAIL = 'hello@b2bcampus.com'

export const PRIVACY: LegalDocument = {
  title: 'Privacy policy',
  updated: UPDATED,
  intro:
    `This policy explains what the driver app and the fleet console collect, why, and what happens to it. ` +
    `It covers drivers who use the app and office staff who use the console. ` +
    `The service is operated by ${COMPANY} (“we”).`,
  sections: [
    {
      heading: 'Who the data is about, and who decides',
      body: [
        'A driver does not sign up for this app. Their employer — the fleet — creates the account and decides what is recorded, how long it is kept, and who in the office can see it. The fleet is the data controller; we provide the software and act on their instructions.',
        'That matters for a driver reading this: questions about your own record go to your fleet office first. We cannot change or delete a fleet’s records on request from a driver without the fleet’s instruction.',
      ],
    },
    {
      heading: 'What the app collects',
      body: [
        '- Your name, work email and phone number, entered by your fleet office.',
        '- Your duty status — off duty, sleeper, driving, on duty — with the time of every change. This is the legal record of your working hours.',
        '- Your location at the moment you mark yourself arrived at a stop: latitude, longitude, and how far that was from the stop. It is recorded at that moment only. The app does not follow you between stops and does not run in the background.',
        '- Photographs you take of delivery paperwork and of faults you find on a vehicle, together with any note you add to them.',
        '- Vehicle inspections and fault reports you submit.',
        '- Messages between you and your fleet office.',
        '- Which vehicle you are signed on to, and when.',
        '- Training courses assigned to you and how far through them you are.',
      ],
    },
    {
      heading: 'What it does not collect',
      body: [
        'The app does not track your position continuously, does not record audio, does not read your contacts, photos or messages, and contains no advertising or analytics trackers. Camera and location access are used only at the moment you use the feature that needs them, and both can be refused — an arrival recorded without a position is simply marked unverified.',
      ],
    },
    {
      heading: 'Why each thing is collected',
      body: [
        '- Duty status and hours: to keep the working-time record the law requires of the fleet, and to warn you before you break a limit.',
        '- Location at a stop: to show the office that a delivery was made where it was meant to be.',
        '- Photographs: to evidence a delivery or a defect.',
        '- Messages and route information: to run the day’s work.',
      ],
    },
    {
      heading: 'Who it is shared with',
      body: [
        'Your fleet office sees everything about you listed above. Other drivers do not see your records.',
        'We use these processors to run the service:',
        '- Supabase — database, authentication and file storage.',
        '- Resend — sending account emails.',
        '- Google Maps — showing maps and addresses in the console.',
        'We do not sell data, and we do not share it for advertising.',
        '[List any other party the fleet shares records with — an insurer, a compliance bureau, a customer portal.]',
      ],
    },
    {
      heading: 'How long it is kept',
      body: [
        'Working-hours records are kept for as long as the law requires of your fleet, which is [retention period] in [country]. Photographs, messages and inspections are kept for [retention period].',
        'When an account is closed, the person’s login is removed. Their duty records are not: they are the fleet’s legal record of hours worked, and deleting them would leave the fleet unable to answer an inspection.',
      ],
    },
    {
      heading: 'Your rights',
      body: [
        'You can ask for a copy of your data, ask for a correction, or object to how it is used. A correction to a past duty log is built into the app: ask your office through the app, and they approve or reject it — they cannot silently edit your log.',
        `For anything else, contact your fleet office first. If you cannot resolve it there, write to us at ${CONTACT_EMAIL} or call ${PHONE}. [Add the supervisory authority drivers may complain to.]`,
      ],
    },
    {
      heading: 'Security',
      body: [
        'Access is controlled per fleet at the database, not only in the app: a driver’s login can read that driver’s own records and their fleet’s shared ones, and nothing else. Files are stored privately and reached through short-lived links. Traffic is encrypted in transit.',
      ],
    },
    {
      heading: 'Changes',
      body: [
        'If this policy changes in substance, the date at the top changes with it and the fleet is told before the change takes effect.',
      ],
    },
    {
      heading: 'Contact',
      body: [`${COMPANY}`, ADDRESS, `Phone: ${PHONE}`, CONTACT_EMAIL],
    },
  ],
}

export const TERMS: LegalDocument = {
  title: 'Terms of service',
  updated: UPDATED,
  intro:
    `These terms cover use of the driver app and the fleet console, operated by ${COMPANY}. ` +
    `Using either means accepting them.`,
  sections: [
    {
      heading: 'Who may use it',
      body: [
        'Accounts are created by a fleet for its own staff and drivers. You may not share your login, and you must tell your fleet office if you think someone else has it.',
        'The app is a tool for work. It is not for personal use and the fleet may withdraw access at any time.',
      ],
    },
    {
      heading: 'What you agree to record honestly',
      body: [
        'Duty status, arrivals, inspections and paperwork are a legal record. Recording a status you are not in, or an arrival you have not made, may be an offence as well as a breach of these terms.',
        'The app warns rather than refuses in several places — an early break, an arrival it could not verify. A warning you chose to pass is recorded as such. It is not permission.',
      ],
    },
    {
      heading: 'What the hours calculations are, and are not',
      body: [
        'The app works out remaining hours and flags breaches from the rule book your fleet has chosen. Those figures are a guide to help you and your office plan. They are not legal advice and they are not a defence.',
        'Where a fleet writes its own rule book, its limits are the fleet’s policy, not the law. The app labels those breaches as fleet rules for exactly that reason. Responsibility for complying with the hours regulations that apply to you stays with you and your employer.',
      ],
    },
    {
      heading: 'Availability',
      body: [
        'We aim to keep the service running but do not guarantee it is uninterrupted. Much of the app keeps working without a signal and sends when one returns; some of it cannot.',
        '[State any uptime commitment agreed with the fleet, or say there is none.]',
      ],
    },
    {
      heading: 'Liability',
      body: [
        '[This section is a commercial decision and should be written or checked by a lawyer. It usually limits liability to fees paid, excludes indirect loss, and does not exclude anything that cannot lawfully be excluded — death or personal injury caused by negligence, or fraud.]',
      ],
    },
    {
      heading: 'Ending it',
      body: [
        'A fleet can stop using the service at any time. On request within [period] of closing an account we will return or delete the fleet’s data, subject to records we are required to keep.',
      ],
    },
    {
      heading: 'Governing law',
      body: ['These terms are governed by the laws of [jurisdiction].'],
    },
    {
      heading: 'Contact',
      body: [`${COMPANY}`, ADDRESS, `Phone: ${PHONE}`, CONTACT_EMAIL],
    },
  ],
}

export const SUPPORT: LegalDocument = {
  title: 'Support',
  updated: UPDATED,
  intro:
    'Help with the driver app and the fleet console. A person reads everything sent here.',
  sections: [
    {
      heading: 'Contact us',
      body: [
        `Email: ${CONTACT_EMAIL}`,
        `Phone: ${PHONE}`,
        ADDRESS,
        'Hours: Monday to Saturday, 8:00–20:00 IST',
        'Typical reply: the same working day',
        'Please include your fleet’s name and what you were doing when the problem happened. A screenshot usually saves a round trip.',
      ],
    },
    {
      heading: 'Drivers: try your fleet office first',
      body: [
        'Most of what a driver needs is decided by their own office, not by us — a missing route, the wrong truck, a log that needs correcting, an account that will not sign in. Your office can fix all of those today. We cannot change a fleet’s records on request.',
      ],
    },
    {
      heading: 'Common things',
      body: [
        '- Cannot sign in: your office creates your account and sends a one-time password. Ask them to send it again.',
        '- A past log is wrong: open the day, ask for a correction, and your office approves it. Nobody can silently edit your log.',
        '- Hours clocks show a dash: your office has not chosen an hours rule book yet.',
        '- An arrival says “unverified”: the app could not get a position at that moment. The arrival still counts.',
      ],
    },
    {
      heading: 'Reporting something broken',
      body: [
        `Write to ${CONTACT_EMAIL} or call ${PHONE} with what you expected, what happened, and roughly when. If it affects a driver’s legal record, say so — those are looked at first.`,
      ],
    },
  ],
}
