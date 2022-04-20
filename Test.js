let teams = [
    { team_id: '167' },
    { team_id: '168' },
    { team_id: '169' },
    { team_id: '170' },
    { team_id: '171' },
    { team_id: '172' },
    { team_id: '173' },
    { team_id: '174' },
    { team_id: '175' },
    { team_id: '176' },
    { team_id: '177' },
    { team_id: '178' },
    { team_id: '179' }
];

let groups = [];
let numberOfGroups = 2;
const j = teams.length;

for(let i = 0; i < numberOfGroups; i++){
    groups.push([]);
}
console.log(groups.length);
let groupNumber = 0;
for(let i = 0; i < j; i++){
    let index = getRandomInt(0, teams.length-1);
    let randomTeam = teams[index];
    // console.log(groups[groupNumber]);
    groups[groupNumber].push(randomTeam);
    teams.splice(index, 1);
    if(groupNumber < groups.length-1){
        groupNumber++;
    }
    else{
        groupNumber = 0;
    }
}


console.log(teams);
console.log(groups);


// for (let i = 0; i < numberOfGroups; i++){
//     let index1 =  getRandomInt(0, members.length-1);
//     let member1 = members[index1];
//     members.splice(index1, 1);
//     //find member 2
//     let index2 = getRandomInt(0, members.length-1);
//     let member2 = members[index2];
//     members.splice(index2, 1);

//     teams.push({member1: member1, member2: member2});
// }

//random integer
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}