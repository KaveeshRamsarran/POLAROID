// Optional discoveries deepen the same story without adding puzzle gates.
// These are physical records, not an omniscient explanation of the haunting.
export const LORE = {
  closing: {
    title: "THE FINAL WEEK",
    date: "Box-office notice / December 1998",
    paragraphs: [
      "Bellwether opened in 1959. The brass lettering outside was paid for by a collection at the mill. On wet afternoons the foyer stayed open, even when nobody bought a ticket.",
      "The last public screening was Sunday. The demolition survey is tomorrow. Leave the posters in their frames and do not throw away the lost-property box. Somebody still telephones about it.",
      "Below the manager's signature, somebody has written in pencil: Twenty years is a long time to keep a coat.",
    ],
  },
  register: {
    title: "THE MAN IN F8",
    date: "Usher's reservation book / 1978",
    paragraphs: [
      "AVERY, THOMAS. Friday late show. F8, aisle side. Keep F7 free until the school bus arrives. He pays for both, even when his daughter cannot come.",
      "He mends the clock above concessions without charging us. Dark coat, pale repair at the right cuff. Always stays until the screen goes white. Says leaving before the end would be rude.",
      "The last entry is dated 14 November. Beside F8 there is a small mark: Still inside. No one has crossed it out.",
    ],
  },
  coat: {
    title: "THE WARM COAT",
    date: "Found at F8",
    paragraphs: [
      "A heavy wool coat, folded as though its owner expects to be back in a moment. The right cuff has been repaired with pale thread. Inside is half a ticket: F8. The date is 14 November 1978.",
      "A note in the pocket: Ruth — if we lose each other, wait by the side door. I will find you. Dad.",
      "The wool is warm. The note is dry. Everything else in this row smells of cold dust.",
    ],
  },
  belongings: {
    title: "UNCLAIMED",
    date: "Lost property / envelope 28",
    paragraphs: [
      "Three umbrellas, a child's red mitten, and a bus timetable folded to the Friday service. A label reads: R. Avery, collected by aunt, 15 November 1978.",
      "The mitten was put back in the box. On the label's reverse: Keep it with Dad's things. He will know it is mine.",
    ],
  },
  booth: {
    title: "ADA'S SHIFT BOOK",
    date: "Projection booth / 14 November 1978",
    paragraphs: [
      "22:40. Hot smell at the amplifier cabinet again. Reported to Hale. He says finish the last reel; refunds would close us before Christmas.",
      "23:06. Service leaf still fouls the stock cabinets. Took the spare key. If the house lights fail, lead them behind the screen. Do not send them back up the middle aisle.",
      "The next line presses hard enough to tear the paper: A light on a screen is not a reason to keep people in their seats.",
    ],
  },
  records: {
    title: "TWO ACCOUNTS",
    date: "Maintenance and incident files / November 1978",
    paragraphs: [
      "MAINTENANCE, 14 NOVEMBER: Service door strikes stored cabinets. Clear the full swing before admitting the audience. Manager Gordon Hale declined: After the late show.",
      "INCIDENT, 15 NOVEMBER: Projectionist Ada Bell absent from post. Evacuation delayed. The witness page is missing. The words house lights not raised have been struck through.",
      "FILM STORAGE: A section was removed before the public inquiry. Drawer A. BELL, marked SERVICE ROUTE. The two photographs of the exit and Ada explain where it belongs.",
    ],
  },
  letter: {
    title: "SOMEONE STILL CALLS",
    date: "Letter to Bellwether / 3 December 1998",
    paragraphs: [
      "You said there was nothing left of my father's. Then the local paper printed a picture of your lost-property shelf. I recognized the pale stitching. I sewed that cuff myself.",
      "Ada sent me through the service passage. Dad went back for the people who were still sitting down. The manager had told them to wait for the picture to return. I waited outside until morning.",
      "Please leave the side door open for the survey. I know how that sounds. For twenty years I have dreamed he is standing on the other side, trying to hear me. — Ruth Avery",
    ],
  },
  witness: {
    title: "THE PAGE THAT DID NOT FIT",
    date: "Carbon copy behind the maintenance board",
    paragraphs: [
      "I saw Miss Bell carrying the service key, not a film can. She was waving us away from the screen. Mr Avery stood in the aisle and repeated what she said to the people at the back.",
      "Hale kept saying it was only a fault with the picture. By the time he asked for the house lights, the smoke was in the balcony window.",
      "I heard a man at the side door asking whether a girl in a red scarf was outside. Then the door shut. Statement taken 16 November. This copy has no signature from the inquiry clerk.",
    ],
  },
  watch: {
    title: "THE SAME REPAIR",
    date: "Photographic detail / the patron's right cuff",
    paragraphs: [
      "Pale stitches on dark wool. A narrow watch strap worn almost through. The repair matches the coat at F8 and the description in the reservation book.",
      "The other faces belong to their screenings. This detail survives every change of reel. The cinema seems to remember him waiting, even in years that cannot have been his last night.",
    ],
  },
};

export function discoveredLore(state) {
  const found = { ...state.lore };
  // Existing saves gain the records their player has already physically found.
  if (state.items.coat) found.coat = true;
  if (state.items.records) found.records = true;
  if (state.tasks.belongings) found.belongings = true;
  if (state.evidence.watch) found.watch = true;
  return Object.keys(LORE).filter((id) => found[id]);
}

export function loreText(id) {
  const note = LORE[id];
  return `<p class="lore-date">${note.date}</p>${note.paragraphs.map((p) => `<p class="cinema-note">${p}</p>`).join("")}`;
}

export function loreJournal(state) {
  const found = discoveredLore(state);
  if (!found.length) return "";
  return `<section class="lore-journal"><h3>FOUND RECORDS <small>${found.length}</small></h3><p>Optional details from Bellwether. Your next task stays above.</p>${found.map((id) => `<details><summary>${LORE[id].title}</summary>${loreText(id)}</details>`).join("")}</section>`;
}
