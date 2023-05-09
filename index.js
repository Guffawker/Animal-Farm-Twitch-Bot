const tmi = require('tmi.js');
const sqlite3 = require('sqlite3').verbose();

let streamName = 'Guffawker'

const options = {
  options: {
    debug: true,
    messagesLogLevel: "info",
  },
  connection: {
    cluster: 'aws',
    reconnect: true,
    secure: true,
  },
  identity: {
    username: 'BOTNAME', //Your Bot Username
    password: 'OAUTHTOKEN', //Your Bot Oauth Token (can be found at ....)
  },
  channels: [streamName], //The name of the channel you are connectiong to
};

const client = new tmi.client(options);

//Variables to create game
let playerTotal = 0;
let gameActive = false;
let joinable = false;
let allPlayers = [];
let roundActive = false;
let votingActive = false;
let roundTime = 60000;  //Edit this to change the time it takes to start the game and change between action rounds and voting rounds.

//Variables for roles
let wolfNumber;
let extrasNumber;
let sheepNumber;
let totalWolfs = 0;
let totalExtras = 0;
let totalSheep = 0;
let farmersActed = 0;
let sheepSaved = 0;
let sheepDodged = 0;
let sheepDead = 0;
let crowsDead = 0;
let farmersDead = 0;

function wolfAction(self){ //Manages the actions of the Wolf class.
  while(allPlayers[self].Acted === 0){
    let target = getRandomIntInclusive(0, ((allPlayers.length) - 1));
    if(farmersActed >= 1){
      sheepSaved = sheepSaved + 1;
      farmersActed = farmersActed - 1;
      allPlayers[self].Acted = 1;
    }
    else if(allPlayers[target].Role === 'wolf'){
      target = getRandomIntInclusive(0, ((allPlayers.length) - 1));
    }
    else if(allPlayers[target].Role === 'sheep' && allPlayers[target].Acted === 0){
      allPlayers[target].Alive = 0;
      sheepDead = sheepDead + 1;
      sheepNumber = sheepNumber - 1;
      allPlayers[self].Acted = 1;
    }
    else if(allPlayers[target].Role === 'sheep' && allPlayers[target].Acted === 1){
      let chanceKill = getRandomIntInclusive(0,1);
      if(chanceKill === 0){
        sheepDodged = sheepDodged + 1;
        allPlayers[self].Acted = 1;
      }
      else{
        allPlayers[target].Alive = 0;
        sheepDead = sheepDead + 1;
        sheepNumber = sheepNumber - 1;
        allPlayers[self].Acted = 1;
      }
    }
    else if(allPlayers[target].Role === 'farmer'){
      allPlayers[target].Alive = 0;
      extrasNumber = extrasNumber - 1;
      farmersDead = farmersDead + 1;
      allPlayers[self].Acted = 1;
    }
    else if(allPlayers[target].Role === 'crow'){
      allPlayers[target].Alive = 0;
      extrasNumber = extrasNumber - 1;
      crowsDead = crowsDead + 1;
      allPlayers[self].Acted = 1;
    }
  }
}
function sheepAction(self){ //Manages the actions of the Sheep class.
  allPlayers[self].Acted = 1;
}
function farmerAction(self){ //Manages the actions of the Farmer class.
  farmersActed = farmersActed + 1;
  allPlayers[self].Acted = 1;
}
function crowAction(self){ //Manages the actions of the Crow class.
  for( var i=0, l=allPlayers.length, found = false; i<l; i++) {
    if(allPlayers[i].Role === 'wolf' && allPlayers[i].Acted === 1){
      client.action(streamName, 'CAW.');
    }
  }
  allPlayers[self].Acted = 1;
}
function clearVotes(){ //Function that resets variables and manages votes to eleminate players.
  for( var i=0, l=allPlayers.length; i<l; i++) {
    if(allPlayers[i].Votes > ((wolfNumber + sheepNumber + extrasNumber)/2)){
      allPlayers[i].Alive = 0;
      client.action(streamName, allPlayers[i].twitchName + ' was voted off this round');
      if(allPlayers[i].Role === 'wolf'){
        wolfNumber = wolfNumber - 1;
      }
      else if(allPlayers[i].Role === 'sheep'){
        sheepNumber = sheepNumber - 1;
      }
      else if(allPlayers[i].Role === 'farmer' || allPlayers[i].Role === 'crow'){
        extrasNumber = extrasNumber - 1;
      }
    }
    allPlayers[i].Voted = 0;
    allPlayers[i].Votes = 0;
    allPlayers[i].Acted = 0;
    farmersActed = 0;
    sheepSaved = 0;
    sheepDodged = 0;
    sheepDead = 0;
    crowsDead = 0;
    farmersDead = 0;
  }
}
function getRandomIntInclusive(min, max) { //Random Number Generator for Assigning Roles.
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1) + min); //The maximum is inclusive and the minimum is inclusive
}
function assignRoles(){ //Function that assignes the rolles for each player.
  for( var i=0, l=allPlayers.length; i<l; i++) {
    while(allPlayers[i].Role === 0){
      let myRole = getRandomIntInclusive(1,4);
                console.log(myRole);
        if (myRole === 4 && totalWolfs < wolfNumber){
          allPlayers[i].Role = 'wolf';
          totalWolfs = totalWolfs + 1;
        }
        if (myRole === 3 && totalExtras < extrasNumber){
          allPlayers[i].Role = 'farmer';
          totalExtras = totalExtras + 1;
        }
        if (myRole === 2 && totalExtras < extrasNumber){
          allPlayers[i].Role = 'crow';
          totalExtras = totalExtras + 1;
        }
        if (myRole === 1 && totalSheep < sheepNumber){
          allPlayers[i].Role = 'sheep';
          totalSheep = totalSheep + 1;
        }
      }
    }
  client.action(streamName, 'The game is now begining with ' + (playerTotal) + ' players. All players have been assigned their roles. Please wait for the next game to join.');
  startRound();
  }
function createGame(){ //Function that sets the peramiters for the game based on the number of players.
  if(playerTotal < 3){
    endGame();
  }
  else if(playerTotal > 2 && playerTotal < 8){
    wolfNumber = 1;
    extrasNumber = 1;
    sheepNumber = (playerTotal - wolfNumber - extrasNumber);
    assignRoles();
  }
  else if(playerTotal > 7 && playerTotal < 13){
    wolfNumber = 2;
    extrasNumber = 2;
    sheepNumber = (playerTotal - wolfNumber - extrasNumber);
    assignRoles();
  }
  else if(playerTotal > 12 && playerTotal < 18){
    wolfNumber = 3;
    extrasNumber = 3;
    sheepNumber = (playerTotal - wolfNumber - extrasNumber);
    assignRoles();
  }
  else if(playerTotal > 17){
    wolfNumber = 4;
    extrasNumber = 4;
    sheepNumber = (playerTotal - wolfNumber - extrasNumber);
    assignRoles();
  }
}
function endGame(){ //Function to stop the game from running and restart it.
  if(playerTotal < 3){
    client.action(streamName, 'There are not enough players to start a game.');
  }
  else if (wolfNumber === 0) {
    client.action(streamName, 'Congratulations:');
    for( var i=0, l=allPlayers.length; i<l; i++) {
      if(allPlayers[i].Role !== 'wolf'){
        client.action(streamName, allPlayers[i].twitchName);
      }
    }
    client.action(streamName, 'The Sheep have won the game.');
  }
  else if (sheepNumber <= wolfNumber) {
    client.action(streamName, 'Congratulations:');
    for( var i=0, l=allPlayers.length; i<l; i++) {
      if(allPlayers[i].Role === 'wolf'){
        client.action(streamName, allPlayers[i].twitchName);
      }
    }
    client.action(streamName, 'The Wolves have won the game.');
  }
  playerTotal = 0;
  gameActive = false;
  joinable = false;
  totalWolfs = 0;
  totalExtras = 0;
  totalSheep = 0;
  allPlayers = [];
  farmersActed = 0;
  sheepSaved = 0;
  sheepDodged = 0;
  sheepDead = 0;
  crowsDead = 0;
  farmersDead = 0;
  console.log("reset");
}
function preventJoin(){ //Function that prevents players from joining the game once it begins.
  joinable = false;
  createGame();
}
function startRound(){ //Function to allow players to take actions and reset gamestate between rounds.
  roundActive = true;
  votingActive = false;
  clearVotes();
  if(wolfNumber === 0){
    endGame();
  }
  else if(gameActive === true){
    client.action(streamName, 'The round is starting. You may choose to take an !action, or not. Use actions to deduce and root out the wolfs.');
    setTimeout(votingRound, roundTime);
  }
  else{
    endGame();
  }
}
function votingRound(){ //Function to allow players to vote and inform gamestate changes.
  roundActive = false;
  votingActive = true;
  if(wolfNumber >= (sheepNumber + extrasNumber)){
    endGame();
  }
  else if(gameActive === true){
    client.action(streamName, 'Voting begins. Use "!vote name" to vote for a player to remove. A player must recieve majority votes to be cast off.');
    if(sheepSaved > 0){
      client.action(streamName, `${sheepSaved} Sheep were saved by farmer(s) this round.`);
    }
    if(sheepDead > 0){
      client.action(streamName, `${sheepDead} Sheep died this round.`);
    }
    if(sheepDodged > 0){
      client.action(streamName, `${sheepDodged} Sheep evaded wolfs this round.`);
    }
    if(farmersDead > 0){
      client.action(streamName, `${farmersDead} Farmers died this round.`);
    }
    if(crowsDead > 0){
      client.action(streamName, `${crowsDead} Crows died this round.`);
    }
    client.action(streamName, 'The remaining players are:');
      for( var i=0, l=allPlayers.length; i<l; i++) {
        if(allPlayers[i].Alive === 1){
          client.action(streamName, allPlayers[i].twitchName);
        }
      }
    setTimeout(startRound, roundTime);
  }
  else{
    endGame();
  }
}
function takeAction(userRole, self){ //Function that takes actions for the players during each round.
  if(userRole === 'wolf'){
    wolfAction(self);
  }
  if(userRole === 'farmer'){
    farmerAction(self);
  }
  if(userRole === 'sheep'){
    sheepAction(self);
  }
  if(userRole === 'crow'){
    crowAction(self);
  }
}

client.connect();

client.on('chat', (channel, user, message, self) => { //!startgame command
  let isMod = user.mod || user['user-type'] === 'mod';
  let isBroadcaster = channel.slice(1) === user.username;
  let isModUp = isMod || isBroadcaster;
  if (message === '!startgame' && gameActive === false && isModUp) {
    gameActive = true;
    joinable = true;
    client.action(streamName, 'A game has begun. All viewers have 1 minute to !join.');
    setTimeout(preventJoin, roundTime);
      }
});

client.on('chat', (channel, user, message, self) => { //!join command
  if (message === '!join' && gameActive === true && joinable === true) {
    for( var i=0, l=allPlayers.length, found = false; i<l; i++) {
         if( allPlayers[i].twitchName == user['username']) {
            found = true;
            break;
        }
    }
    if( found) {
            client.action(streamName, 'You are already in this game.' );
    }
    else {
      client.action(streamName, user['username'] + ' You have joined the game.');
      allPlayers[playerTotal] = {twitchName: user['username'], Role: 0, Acted: 0, Alive: 1, Voted: 0, Votes: 0};
      playerTotal = playerTotal + 1;
    }
  }
  else if (message === '!join' && (gameActive === false || joinable === false)){
    client.action(streamName, 'You cannot join the game at this time.' );
  }
});

client.on('chat', (channel, user, message, self) => { //!list command
  if (message === '!list') {
    var iterator = allPlayers.values();
    for(let elements of iterator)
    console.log(elements);
      }
});

client.on('chat', (channel, user, message, self) => { //!action command
  if (message === '!action' && roundActive === true) {
    for( var i=0, l=allPlayers.length, found = false; i<l; i++) {
      if( allPlayers[i].twitchName == user['username'] && allPlayers[i].Alive === 1) {
        found = true;
        userRole = allPlayers[i].Role;
        canAct = allPlayers[i].Acted;
        self = i;
        break;
      }
    }
    if(canAct === 1 && allPlayers[i].Alive === 1){
      client.action(streamName, user['username'] + ' You have already Acted this round.');
    }
    else if (found === true && allPlayers[i].Alive === 0){
      client.action(streamName, user['username'] + ' You are dead.');
    }
    else if(found === true && votingActive === true){
      client.action(streamName, user['username'] + ' Please wait till voting has finished to take an action.');
    }
    else if(found === true && gameActive === false){
      client.action(streamName, user['username'] + ' There is no game in progress.');
    }
    else if(found === true && canAct === 0){
      client.action(streamName, allPlayers[i].twitchName + ' has taken their action.');
      takeAction(userRole, self);
    }
    else{
      client.action(streamName, user['username'] + ' you are not in this game.');
    }
  }
});

client.on('chat', (channel, user, message, self) => { //!endgame command
  let isMod = user.mod || user['user-type'] === 'mod';
  let isBroadcaster = channel.slice(1) === user.username;
  let isModUp = isMod || isBroadcaster;
  if (message === '!endgame' && isModUp) {
    if(gameActive === true){
      client.action(streamName, user['username'] + ' has terminated the game.');
      endGame();
    }
    else{
      client.action(streamName, 'There is no game to terminate.');
    }
  }
});

client.on('chat', (channel, user, message, self) => { //!vote command
  if (message.startsWith("!vote") && gameActive === true) {
    if(votingActive === true){
      if(self || message[0] !== '!') return;
      let parameters = message.split(' ').filter(n => n);
      let command = parameters.shift().slice(1).toLowerCase();
      let msg = `${user['username']} voted for ${parameters[0]}`;
      if (parameters[0] === undefined){
        client.action(streamName, 'Please vote for an active player.')
      }
      else{
        for(var i=0, l=allPlayers.length; i<l; i++){
            if(allPlayers[i].twitchName === user['username']){
              if(allPlayers[i].Voted === 0 && allPlayers[i].Alive === 1){
                for(var t=0, l=allPlayers.length; t<l; t++){
                  if (parameters[0].toLowerCase() === allPlayers[t].twitchName){
                    client.action(streamName, msg);
                    allPlayers[t].Votes = (allPlayers[t].Votes + 1);
                    allPlayers[i].Voted = 1;
                }
              }
            }
            else{
              client.action(streamName, 'You have already voted this round.');
            }
          }
        }
      }
      }
      else{
        client.action(streamName, 'Please wait for the voting round to begin.');
      }
    }
    else if (message.startsWith("!vote") && gameActive === false){
      client.action(streamName, 'There is no active game.');
    }
});
