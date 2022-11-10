/* IMPORTANT - READ THIS FIRST TO AVOID INADVERTENTLY SENDING EMAILS TO MANY PEOPLE
 *
 * Running this script will automatically send emails to many people. Therefore be careful with executing it!
 *
 * # Development
 * If you want to run it for development purposes then select doDevelopmentRun as the "function to run" above.
 * This will not actually send any emails, but instead print to the Log which emails would have been sent.
 *
 * The unit tests can be executed with doTests(). Make sure to add unit tests if you are adding tricky
 * functionality since many people can be affected by it!
 *
 * # Production (the for-real runs)
 * For "production runs" the doProductionRun() function is used. This will actually send emails.
 * This should NOT be executed manually. There are automatic triggers set up for it.
 *
 */

/* Default should be true to make sure no emails are send if people
 * would by accident execute run() directly! */
var DEBUG_MODE = true;

function doDevelopmentRun(e) {
  DEBUG_MODE = true;
  run();
}

function doProductionRun(e) {
  DEBUG_MODE = false;
  run();
}

function run() {
  var event = getCoffeeEvent();
  var include_event_owner = true;
  var guest_list = event.getGuestList(include_event_owner);
  var interested_people = getListOfPeopleThatAreUpForACoffee(guest_list);
  var matches = matchInterestedPeople(interested_people);
  var output = generateOutput(matches);
  sendAllNotificationEmails(matches);
}

function getCoffeeEvent() {
  var MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
  var now = new Date();
  var day = now.getDay();
  var now = new Date(now.getTime());
  var next_week = new Date(now.getTime() + 7 * MILLISECONDS_PER_DAY);
  var now_str = Utilities.formatDate(now, 'Europe/Amsterdam', 'MMMM dd, yyyy HH:mm:ss');
  var next_week_str = Utilities.formatDate(next_week, 'Europe/Amsterdam', 'MMMM dd, yyyy HH:mm:ss');
  Logger.log("getCoffeeEvent(): Looking for event between " + now_str + " and " + next_week_str);
  var events = CalendarApp.getEvents(now, next_week, {search: 'Random Coffee Encounter Software'});
  var coffee_event = events[0];
  Logger.log("getCoffeeEvent(): Using " + coffee_event.getTitle() + " at " + coffee_event.getStartTime());
  return coffee_event;
}

function getListOfPeopleThatAreUpForACoffee(guest_list) {
  var yes_list = [];
  var no_list = [];
  for (var i = 0; i < guest_list.length; i++) {
    var guest = guest_list[i];
    //Logger.log("Status: %s (%s) = %s", guest.getName(), guest.getEmail(), guest.getGuestStatus());
    if (guest.getGuestStatus() == CalendarApp.GuestStatus.YES) {
      yes_list.push(guest.getEmail());
    } else {
      no_list.push(guest.getEmail());
    }
  }
  Logger.log("getListOfPeopleThatAreUpForACoffee(): Interested people are: %s\nUnavailable people are: %s", yes_list, no_list);
  return yes_list;
}

function getInterestedPeopleNames(guest_list) {
  var yes_list = [];
  for (var i = 0; i < guest_list.length; i++) {
    var guest = guest_list[i];
    if (guest.getGuestStatus() == CalendarApp.GuestStatus.YES) {
      yes_list.push(guest.getName());
    }
  }
  return yes_list;
}


function matchInterestedPeople(interested_people) {
  var matches = {};

  if (interested_people.length <= 1) {
    Logger.log("There is nobody to have a coffee with.");
    return matches;
  }
  // Copy interested_people to leave it intact
  var people_left = getCopyOfArray(interested_people);

  while (people_left.length > 0) {
    var person1 = popRandomPerson(people_left);
    if (people_left.length > 0) {
      var person2 = popRandomPerson(people_left);
      addMatch(matches, person1, person2);
    } else {
      addThirdPersonToMatch(interested_people, matches, person1);
    }
  }
  for (var i = 0; i < people_left.length; i++) {
    matches[people_left[i]] = [];
  }
  return matches;
}

function getCopyOfArray(original_array) {
  new_array = [];
  for (var i = 0; i < original_array.length; i++) {
    new_array[i] = original_array[i];
  }
  return new_array;
}

function popRandomPerson(people) {
  var index = getRandomIndex(people.length);
  return people.splice(index, 1)[0];
}

function getRandomIndex(number_of_options) {
  var random_index = Math.floor(Math.random() * number_of_options);
  // In rar cases the random number can be 1.00, which would result
  // in an invalid index. Let's prevent that.
  var MAX_INDEX = number_of_options - 1;
  if (random_index >= MAX_INDEX) {
    random_index = MAX_INDEX;
  }
  return random_index;
}

function addMatch(matches, person1, person2) {
  matches[person1] = [person2];
  matches[person2] = [person1];
}

function addThirdPersonToMatch(interested_people, matches, third_person) {
  // Make sure we don't select the third person itself to match with!
  possible_matches = getCopyOfArray(interested_people);
  third_person_index = possible_matches.indexOf(third_person);
  possible_matches.splice(third_person_index, 1);

  person1 = popRandomPerson(possible_matches);
  matches[third_person] = [person1];
  matches[person1].push(third_person);

  // In addition, also add to the previous match of person1
  person2 = matches[person1][0];
  matches[third_person].push(person2);
  matches[person2].push(third_person);
}

function generateOutput(matches) {
  if (Object.keys(matches).length == 0) {
    return "No coffee matches created. This might happen if there are not at least 2 people available.";
  }
  output = "";
  for (var key in matches) {
    output += Utilities.formatString("%s is going to have coffee with %s\n", key, matches[key]);
  }
  Logger.log(output);
  return output;
}

function sendAllNotificationEmails(matches) {
  var groups = makeGroups(matches);

  var groups_string = "sendAllNotificationEmails(): The " + groups.size + " groups are:\n"
  for (group of groups) {
    groups_string += Array.from(group).join(", ") + "\n"
  }
  Logger.log(groups_string);

  // The ice breaker and week string all put here instead of inside sendNotificationEmail()
  // because retrieving calendar and sheet info is slow and therefore annoying during development.
  var ice_breaker_question = getIceBreakerQuestion()
  var week_string = getEmailSubjectWeekString()
  for (group of groups) {
    sendNotificationEmail(group, ice_breaker_question, week_string);
  }
}

function makeGroups(matches) {
  /* This function simply loops over all matches and makes groups of the
   * person and the matched persons. The people_in_groups set keeps track
   * of which people are already in groups, such that not multiple groups
   * with the same people are created. */
  var people_in_groups = new Set()
  var groups = new Set()
  for (const [person, matched_persons] of Object.entries(matches)) {
    if (!people_in_groups.has(person)) {
      var new_group = new Set()
      new_group.add(person);
      people_in_groups.add(person)
      groups.add(new_group);
      for (var i = 0; i < matched_persons.length; i++) {
        var matched_person = matched_persons[i];
        new_group.add(matched_person);
        people_in_groups.add(matched_person)
      }
    }
  }
  return groups;
}

function getIceBreakerQuestion() {
  var sheet = SpreadsheetApp.openById('1gr2qMxdhNWDUGyQ0o8GfxZeG4LxHCeTLgpRJjmIaE8E');
  var data = sheet.getDataRange().getValues();
  var index = getRandomIndex(data.length);
  var question = data[index][0];
  Logger.log("getIceBreakerQuestion(): Question=" + question);
  return question;
}

function getEmailSubjectWeekString() {
  var MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;
  event_start_time = getCoffeeEvent().getStartTime()
  var day = event_start_time.getDay();
  var monday_in_the_week_of_the_coffee_event = new Date(event_start_time - (day - 1) * MILLISECONDS_PER_DAY)

  // The week number that would be return with 'w' is incorrect, there let's just use the date for now
  // More info at https://stackoverflow.com/questions/34204388/utilities-formatdate-returning-wrong-week-number)
  return `Week of ${Utilities.formatDate(monday_in_the_week_of_the_coffee_event, 'Europe/Amsterdam', "MMMM d, yyyy")}`
}

function sendNotificationEmail(group, ice_breaker_question, week_string) {
  var receivers = Array.from(group).join(", ")
  var subject = `Random Coffee Encounter Software - ${week_string}`

  // Tip: Construct a message at https://html-online.com/editor/
  var msg = `
    <p><em>This is an automatically generated email.</em></p>
    <p>Hi,</p>
    <p>This week you - the receivers of this email - have been randomly matched to eachother to have a coffee.</p>
    <p>Remember: it is up to you to plan a moment this week to have a coffee together and have an informal chat. More information can be found <a href="https://docs.google.com/presentation/d/1gtlsSJU_inVvy9GII28x1ub5Obo4EvEb6hWTSr45rwE">here</a>.</p>
    <p>The randomly picked ice breaker suggestion of the week is:<br />"${ice_breaker_question}"</p>
    <p>Enjoy it!<br />The Random Coffee Encounter team</p>
    <p><em>You are receiving this email, because you have accepted to the Digital Coffee Encounter meeting in your Google Calendar. To stop receiving this email simply decline attendance or delete that    event from your calendar. In case you did this and you still receive this email, please reach out to stef.vanson@lightyear.one.</em></p>
    <p>&nbsp;</p>
    `;

  sendEmail({
    name: 'Random Coffee Encounter team',
    to: receivers,
    bcc: 'random-coffee@lightyear.one',
    subject: subject,
    htmlBody: msg
  });
}

/* Sends the emails, but allows to run in debug_mode which means
 * that the email is printed to the log instead of actually being
 * sent to avoid spamming! */
function sendEmail(properties) {
  // This won't send the actual email
  var properties_string = "sendEmail(): Debug info\n";
  for (const [key, value] of Object.entries(properties)) {
    properties_string += "  " + key + "=" + value + "\n";
  }
  Logger.log(properties_string);
  if (DEBUG_MODE == false) {
    Logger.log("sendEmail(): Sending the actual email!");
    MailApp.sendEmail(properties);
  }
}


//=================================
//             Tests
//=================================

function doTests() {
  test_matchInterestedPeople_nobody_interested();
  test_matchInterestedPeople_one_person_interested();
  // Enable for some stress testing
  // for (var i = 0; i < 100; i++) {
    test_matchInterestedPeople_even_amount();
    test_matchInterestedPeople_odd_amount();
    test_makeGroups_even_amount();
    test_makeGroups_odd_amount();
    test_getIceBreakerQuestion();
  // }
}

function test_matchInterestedPeople_even_amount() {
  var interested_people = ['stef.vanson@lightyear.one',
                           'fabio.medeiros@lightyear.one',
                           'maria.papadaki@lightyear.one',
                           'ahmed.elsalahy@lightyear.one',
                           'xavier.morizot@lightyear.one',
                           'jan-jaap.kempenaar@lightyear.one',
                           'martin.stoyanov@lightyear.one',
                           'joseph.tweed@lightyear.one'];
  var matches = matchInterestedPeople(interested_people);

  verifyMatches(interested_people, matches);
}

function test_matchInterestedPeople_odd_amount() {
  var interested_people = ['stef.vanson@lightyear.one',
                           'fabio.medeiros@lightyear.one',
                           'maria.papadaki@lightyear.one',
                           'ahmed.elsalahy@lightyear.one',
                           'xavier.morizot@lightyear.one',
                           'jan-jaap.kempenaar@lightyear.one',
                           'martin.stoyanov@lightyear.one'];
  var matches = matchInterestedPeople(interested_people);

  verifyMatches(interested_people, matches);
}

function test_matchInterestedPeople_nobody_interested() {
  var interested_people = [];
  var matches = matchInterestedPeople(interested_people);

  // Expect the matches to be empty if there is nobody to have a coffee with
  assert(Object.keys(matches).length == 0);
}

function test_matchInterestedPeople_one_person_interested() {
  var interested_people = ['stef.vanson@lightyear.one'];
  var matches = matchInterestedPeople(interested_people);

  // Expect the matches to be empty if there is nobody to have a coffee with
  assert(Object.keys(matches).length == 0);
}


function test_makeGroups_even_amount() {
  var interested_people = ['stef.vanson@lightyear.one',
                           'fabio.medeiros@lightyear.one',
                           'maria.papadaki@lightyear.one',
                           'ahmed.elsalahy@lightyear.one',
                           'xavier.morizot@lightyear.one',
                           'jan-jaap.kempenaar@lightyear.one',
                           'martin.stoyanov@lightyear.one',
                           'joseph.tweed@lightyear.one'];
  var matches = matchInterestedPeople(interested_people);
  var groups = makeGroups(matches);

  assert(groups.size == interested_people.length / 2);
}

function test_makeGroups_odd_amount() {
  var interested_people = ['stef.vanson@lightyear.one',
                           'fabio.medeiros@lightyear.one',
                           'maria.papadaki@lightyear.one',
                           'ahmed.elsalahy@lightyear.one',
                           'xavier.morizot@lightyear.one',
                           'jan-jaap.kempenaar@lightyear.one',
                           'martin.stoyanov@lightyear.one'];
  var matches = matchInterestedPeople(interested_people);
  var groups = makeGroups(matches);

  // Rounded down since there is one group of 3 people!
  assert(groups.size == (interested_people.length - 1) / 2);
}

function test_getIceBreakerQuestion() {
  question = getIceBreakerQuestion();
  // Just check if it's at least 10 characters long.
  assert(question.length > 10);
}

// Helper function for verifying if the matches make sense
function verifyMatches(interested_people, matches) {
  // dumpInterestedPeopleAndMatches(interested_people, matches);
  assert(interested_people.length == Object.keys(matches).length);
  for (var key in matches) {
    // Logger.log("%s is matched with %s", key, matches[key]);
    assert(matches[key].length == 1 || matches[key].length == 2);
    for (var i = 0; i < matches[key].length; i++) {
      var match =  matches[key][i];
      // Logger.log("Asserting that %s is in %s", key, matches[match]);
      assert(matches[match].indexOf(key) != -1);
    }
  }
}

function dumpInterestedPeopleAndMatches(interested_people, matches) {
  output = "Dumping interested people and their matches:\n"
  for (var i = 0; i < interested_people.length; i++) {
    /*var event = getCoffeeEvent();
    var include_event_owner = true;
    var find_name = event.getGuestList(include_event_owner);
    var interested_people = getInterestedPeopleNames(find_name);
    Logger.log(interested_people);*/

    person = interested_people[i];
    output += Utilities.formatString("Person %s matched with %s\n", person, matches[person]);
  }
  Logger.log(output);
}

/* Since Google Apps Script doesn't seem to support unit testing at all :'( this
 * is a super simple and basic way to do asserts. Use the line numbers in the
 * trace to find out what failed. */
function assert(condition) {
  if (condition == false) {
    throw new Error( "Assert failed!" );
  }
}
