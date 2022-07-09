const express = require("express");
const cors = require("cors");
const knex = require("knex");
const bcrypt = require('bcrypt');
const saltRounds = 10;

const db = knex({
    client: "pg",
    connection: {
        host: "127.0.0.1",
        user: "postgres",
        port: "5433",
        password: "azure1234#",
        database: "TournamentManager"
    }
})

const app = express();
app.use(express.json());
app.use(cors());


//register
app.post("/register", (req, res)=> {
    const {email, name, password} = req.body;
    let user_hash = bcrypt.hashSync(password, 10)
    
    db.transaction(trx =>{
            trx.insert({
                user_email_address: email.toLowerCase(),
                user_name: name
            })
            .into("user_profiles")
            .returning("user_email_address")
            .then(loginEmail =>
                trx('user_login')
                .returning("*")
                .insert({
                    login_hash: user_hash,
                    user_email_address: loginEmail[0].user_email_address
                })
                .then(() => {
                    user = {
                        user_email_address: email,
                        user_name: name
                    }
                    // res.json(user);
                })
                .then(() => {
                    db.select("*").from("user_profiles").where("user_email_address", "=", email)
                    .then(user => {
                        delete user[0].user_email_address;
                        res.json(user[0]);
                    });
                }))
                
            //trx commit commits the changes to the database
            .then(trx.commit)
            //if an error occurs we rollback (reverse the changes)
            .catch(trx.rollback)
        })

    .catch(err => {
        res.status(400).json("unable to register")
        console.log(err);
    })
})
//login
app.post("/login", (req, res) => {
    const {email, password} = req.body;

    db.select("user_email_address", "login_hash").from("user_login")
    .where("user_email_address", "=", email)
    .then(data => {
        const isValid = bcrypt.compareSync(password, data[0].login_hash);
        if(isValid){
            return db.select("*").from("user_profiles").where("user_email_address", "=", email)
            .then(user => {
                delete user[0].user_email_address;
                res.json(user[0]);
            })
            .catch(err => res.status(400).json("unable to get user"));
        }
        else{
            res.status(400).json("wrong credentials");
        }
    })
    .catch(err =>{
        console.log(err);
         res.status(400).json("wrong credentials");
    })
})

//create Tournament
app.post("/createT", (req, res) => {
    const {newTournamentName, user} = req.body;     
    db("tournaments").insert({            
        user_id: user.id,
        tournament_name: newTournamentName
    })
    .then(() => {
        db.select("tournament_id").from("tournaments").where("tournament_name", "=", newTournamentName)
        .then(id => {
            res.json(id);
        });
    })
    .catch(err => {
        res.status(400).json("creation failed, maybe try another name");
        console.log(err)
    })
})

//get members
app.get("/getmembers/:id", (req, res) => {
    const {id} = req.params;
    db.select("first_name", "last_name", "member_id").from("members").where("tournament_id", "=", id)
    .then(members => {
        res.json(members);
    })
    .catch(err => {
        res.status(400).json("did not work")
        console.log(err);
    })
})

//add members
app.post("/addmember", (req, res) => {
    const {tournament_id, first_name, last_name} = req.body;
    db("members").insert({
        first_name: first_name,
        last_name: last_name,
        tournament_id: tournament_id
    })
    .returning("member_id")
    .then((id)=> {
        let member_id = id[0].member_id;
        res.json({first_name, last_name, member_id});
    })
    .catch(err => {
        res.status(400).json("could not add member");
        console.log(err);
    })
})
//remove members
app.delete("/deletemember/:id", (req, res) => {
    const {id} = req.params;
    db("members").where("member_id", "=", id).del()
    .then(() => {
        res.json("user deleted");
    })
    .catch(err => {
        res.status(400).json("could not delete user")
    })
})

//random INT
function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
//async so it returns a promise
const createTeams = async(tournament_id) => {    
    return db.select("first_name", "last_name", "member_id").from("members").where("tournament_id", "=", tournament_id)
    .then(members => { //[{props as above}, {}, ...]
        // console.log(members.length);
        let j = members.length/2;
        let teams = [];
        for (let i = 0; i < j; i++){
            //find member 1
            let index1 =  getRandomInt(0, members.length-1);
            let member1 = members[index1];
            members.splice(index1, 1);
            //find member 2
            let index2 = getRandomInt(0, members.length-1);
            let member2 = members[index2];
            members.splice(index2, 1);

            let team = {id_member1: member1.member_id, id_member2: member2.member_id, tournament_id: tournament_id}
            teams.push(team);
        }
        

        return teams;
    })
    .then(teams => {
        db("teams").insert(teams).returning("team_id").then(() => true);
    })
    .then(() => true)
    .catch(err => console.log(err));
}
//async so it returns a promise
const createGroupsMatchups = async (tournament_id, userNumberOfGroups, numberOfTables) => {
    //number of Groups min. 4 and teams min 12 to play with quarter finals -> maybe select fewer users
    return db.select("team_id").from("teams").where("tournament_id", "=", tournament_id)
    .then(teams => {
        let groups = [];
        let numberOfGroups = userNumberOfGroups;
        const j = teams.length;
        //create numberOfGroups amount of empty arrays in the groups array
        for(let i = 0; i < numberOfGroups; i++){
            groups.push([]);
        }
        let groupNumber = 0;
        //randomly get an INT as index then select a team with that and assign it to a group array (increments the group array to equally distribute the teams) 
        for(let i = 0; i < j; i++){
            let index = getRandomInt(0, teams.length-1);
            let randomTeam = teams[index];
            groups[groupNumber].push(randomTeam);
            teams.splice(index, 1);
            if(groupNumber < groups.length-1){
                groupNumber++;
            }
            else{
                groupNumber = 0;
            }
        }
        // console.log(groups);

        return groups;
    })
    .then(groups => {
        let newGroups = groups.map(group => {
            return group.map((member, i) => {
                let name = "team_id" + (i+1);
                return {[name]: member.team_id}
            })
        })
        
        
        //create the finalGroups, 
        let finalGroups = [];
        for(let j = 0; j < newGroups.length; j++){
            let groupObj = {};
            for(let i = 1; i <= newGroups[j].length; i++){
                let propName = "team_id" + i;
                //this adds a new property to the groupObj to match the database schema
                groupObj[propName] = newGroups[j][i-1][Object.keys(newGroups[j][i-1])[0]];
            }
            //console.log(groupObj);
            groupObj["tournament_id"] = tournament_id;
            finalGroups.push(groupObj);
        }
        //insert into database with the desired schema
        db("groups").insert(finalGroups).returning('group_id')
        .then(() => true)
        .catch(err => console.log(err));

        return newGroups;
    })
    .then(groups => {
        // --- MATCHUPS --- //
        // console.log("matchups")
        // console.log(groups); //[ [{}, {}], [], ...]
        //at least 3 objects 
        let matchupsAllGroups = groups.map(group => {
            /*
            we have n teams -> at least 3 
            a team needs to wait at max. 2 games until they play again to prevent long breaks
            - matchup data structure should look like this {team1_id, team2_id, tournament_id, table}
            */
            //group = [{}, {}]
            let numberOfMatchups = 0;
            for(let i = 1; i <= group.length; i++){
                numberOfMatchups += (group.length-i);
            }

            let matchups = [];

                        
            for(let i = 0; i < group.length-1; i++){
                //keep the tables number up to date
                let current = group[i][Object.keys(group[i])];
                let iterator = i;
                let count = group.length-1-i; 
                //works with 3 teams in one group
                for(let j = 0; j < count; j++){
                    
                    let team_id1 = current;
                    let team_id2 = group[iterator+1][Object.keys(group[iterator+1])];

                    matchups.push({
                        team_id1: team_id1,
                        team_id2: team_id2,
                        tournament_id: tournament_id 
                    })
                    iterator++;
                    
                }
                
            }
            // console.log(matchups);

            if(matchups.length < 4){
                return matchups;
            }

            let shuffleMatchups = [];

            let j = matchups.length;
            for(let i = 0; i < j; i++){
                let index = getRandomInt(0, matchups.length-1);
                shuffleMatchups.push(matchups[index]);
                matchups.splice(index, 1);
            }
            return shuffleMatchups;
        })

        console.log(matchupsAllGroups);

        let finalMatchups = [];
        let totalNumberOfMatchups = 0;
        matchupsAllGroups.forEach(element => totalNumberOfMatchups += element.length);
        
        let groupCount = 0;
        let j = 0;
        let table_id = 1;
        for(let i = 0; i < totalNumberOfMatchups; i++){
            if(groupCount >= userNumberOfGroups){
                groupCount = 0;
                j++;
            }
            if(table_id > numberOfTables ){
                table_id = 1;
            }
            if(j > matchupsAllGroups[groupCount.length]-1){
                continue;
            }

            let obj = matchupsAllGroups[groupCount][j];
            obj["table_id"] = table_id;

            finalMatchups.push(obj)

            groupCount++;
            table_id++;
        }

        console.log(finalMatchups);
        

        //insert in database

        db("matchups").insert(finalMatchups).returning('matchup_id').then((data)=> console.log(data));
        
    })
    .then(() => true)
    .catch(err => console.log(err));
}

//create final tournament with min. 12 teams and quarter finals 
app.post("/createFinalTournament", (req, res) => {
    const {numberOfGroups, numberOfTables, tournament_id} = req.body;    
    const creation = async () => {
        if(await createTeams(tournament_id) === true){
            if(await createGroupsMatchups(tournament_id, numberOfGroups, numberOfTables) === true){
                res.json("worked");
            }
            else{
                res.status(500).json("failed");
            }
        }else{
            res.status(500).json("failed");
        }
            
    } 
    creation();
})

app.get("/fetchGroups/:id", (req,res) => {
    const {id} = req.params;
    db.select("*").from("groups").where("tournament_id", "=", id)
    .then(data => {
        //remove null columns
        groups = data.map(group => {
            Object.keys(group).forEach(key => {
                if (group[key] === null) {
                  delete group[key];
                }
            });
            return group;
        })
        res.json(groups);
    })
    .catch(err => {
        res.status(400).json("did not work")
        console.log(err);
    })
})

app.post("/fetchTeams", (req, res) => {
    /*
        thats the current format of teamData_ids 
        0: (3) ['991', '983', '984']
        1: (3) ['988', '985', '994']
        2: (3) ['992', '990', '993']
        3: (3) ['986', '987', '989']
        "replace" the team_ids with arrays of all important information (+ the id)
    */
    const {team_ids, tournament_id} = req.body;
    // console.log(team_ids);

    //fetch only points, standing, goals from the teams table
    db.select("*").from("teams").where("tournament_id", "=", tournament_id)
    .then(data => {
        let final = [];
        team_ids.map(group => {
            final.push(group.map(team_id => {
                return allTeamData = data.find(x => x.team_id === team_id )
            }))
        })
        return final;
    })
    .then(groups => {
        let final = [];
        //fetch the names here from the members table and add to the final Array
        db.select("*").from("members").where("tournament_id", "=", tournament_id)
        .then(members => {
            groups.map(group => {
                final.push(group.map((team, i) => {
                    
                    let firstMember = members.find(x => x.member_id === team.id_member1);
                    delete firstMember.member_id;
                    delete firstMember.tournament_id;
                    
                    let secondMember = members.find(x => x.member_id === team.id_member2);
                    delete secondMember.member_id;
                    delete secondMember.tournament_id;
                    
                    team.name = firstMember.first_name + " " + firstMember.last_name + " + " + secondMember.first_name + " " + secondMember.last_name;
                    return team;
                }))
            })    
            res.json(final);
        })
    })
    .catch(err => {
        res.status(500).json("something went wrong")
        console.log(err);
    })
})

app.get("/fetchMatchups/:tournament_id", (req, res) => {
    //send the matchups back with team names
    const {tournament_id} = req.params;
    let Matchups; 
    let Teams; 

    db.select("*").from("matchups").where("tournament_id", "=", tournament_id)
    .then(matchups => {
        db.select("*").from("members").where("tournament_id", "=", tournament_id)
        .then(members => {
            // Members = members;
            
            db.select("*").from("teams").where("tournament_id", "=", tournament_id)
            .then(teams => {
                Teams = teams.map(team => {
                    delete team.points;
                    delete team.goals;
                    delete team.standing;
                    return team;
                });
                // console.log(Teams);
                Matchups = matchups.map(matchup => {
                    if(matchup.scoreteam1 === null){
                        matchup.scoreteam1 = "";
                    }
                    if(matchup.scoreteam2 === null){
                        matchup.scoreteam2 = "";
                    }

    
                    let team1 = Teams.find(x => x.team_id === matchup.team_id1); 
                    let team2 = Teams.find(x => x.team_id === matchup.team_id2);
                    
                    // console.log(team1);
                    // console.log(team2);
                    //TEAM 1                    
                    let firstMemberT1 = members.find(x => x.member_id === team1.id_member1);
                    let secondMemberT1 = members.find(x => x.member_id === team1.id_member2);
                    matchup.nameTeam1 = firstMemberT1.first_name + " " + firstMemberT1.last_name + " + " + secondMemberT1.first_name + " " + secondMemberT1.last_name;
                    
                    //TEAM 2
                    let firstMemberT2 = members.find(x => x.member_id === team2.id_member1);
                    let secondMemberT2 = members.find(x => x.member_id === team2.id_member2);
                    matchup.nameTeam2 = firstMemberT2.first_name + " " + firstMemberT2.last_name + " + " + secondMemberT2.first_name + " " + secondMemberT2.last_name;

                    // console.log(matchup);

                    return matchup;
                    //add the names to the matchups object
                })
                
                res.json(Matchups);
            })
            
        })        
        
    })
    .catch(err => {
        res.status(500).json("something went wrong")
        console.log(err);
    })
        
})

app.get("/getTournamentSelection/:user_id", (req,res) => {
    const {user_id} = req.params;
    db.select("tournament_id", "tournament_name").from("tournaments").where("user_id", "=", user_id)
    .then(data => {
        res.json(data);
    })
    .catch(err => {
        res.status(500).json("something went wrong")
        console.log(err);
    })
})


const updateTeamStatsNew = async(team_id, score, matchup_id) => {
    let currentGoals;
    let currentPoints;
    let winPoints = 0;
    if(Number(score) === 10){
        winPoints = 1;    
    }

    return db.select("points", "goals").from("teams").where("team_id", "=", team_id)
    .then(data => {
        // console.log(data[0]);
        if(data[0].points === null){
            currentPoints = 0;
        }
        else{
            currentPoints = data[0].points;
        }
        if(data[0].goals === null){
            currentGoals = 0;
        }
        else {
            currentGoals = data[0].goals;
        }
        db("teams")
            .where("team_id", "=", team_id)
            .update({
                points: Number(currentPoints) + Number(winPoints),
                goals: Number(currentGoals) + Number(score)
            })
            .then(() => {
                return true;
            })
            .catch(err => {
                console.log(err);
            })
    })
    .then(() => {
        //this updates the matchup as being "finished"
        db("matchups")
            .where("matchup_id", "=", matchup_id)
            .update({
                matchup_played: true
            })
            .then(()=> true)
            .catch(err => {
                console.log(err);
            })        
    })
    .then(() => true)
    .catch(err => {
        console.log(err);
    })
}

const updateTeamStatsOld = async(matchup_id) => {
    //get the matchup data -> update -> decrease score and points -> take new data and call the updateTeamStatsNew but in the other function
    let scoreTeam1;
    let scoreTeam2;
    return db.select("scoreteam1", "scoreteam2", "team_id1", "team_id2").from("matchups").where("matchup_id", "=", matchup_id)
        .then(data => {
            console.log(data[0]);
            db("matchups")
            .where("matchup_id", "=", matchup_id)
            .update({
                scoreteam1: null,
                scoreteam2: null,
                matchup_played: false
            })
            
        })
        .then(() => true)
        .catch(err => {
            console.log(err);
        })
}

app.post("/updateMatchup", (req,res) => {
    const {scoreTeam1, scoreTeam2, matchup_id} = req.body;
    
    db.select("matchup_played").from("matchups").where("matchup_id", "=", matchup_id)
    .then(value => {
        if(value[0].matchup_played === false){
            db("matchups")
                .where("matchup_id", "=", matchup_id)
                .update({
                    scoreteam1: scoreTeam1,
                    scoreteam2: scoreTeam2,
                }, ["team_id1", "team_id2"])
                .then((team_ids) => {
                    const team_id1 = team_ids[0].team_id1;
                    const team_id2 = team_ids[0].team_id2;
                    const update = async () => {
                            if(await updateTeamStatsNew(team_id1, scoreTeam1, matchup_id) && await updateTeamStatsNew(team_id2, scoreTeam2, matchup_id))
                            {
                                res.json("worked");
                                //update the standings in the group
                                // if(await updateGroupStandings()){
                                //     res.json("worked")
                                // }
                            }
                            else{
                                res.status(500).json("failed");
                            }      
                    }
                    update();
                    //how do to this efficiently 
                        //-> get the teams points and goals -> add them -> make a seperate function -> async -> call it two times with the ids
                        //update somehow the standing of all teams based on the added information -> seperate function
                        // 
                })
                .catch(err => {
                    res.status(500).json("something went wrong")
                    console.log(err);
                })
        }
        else{
            console.log("Hello");
            // if we only update already present information
            const update = async() => {
                if(await updateTeamStatsOld(matchup_id))
                {  
                    db("matchups")
                    .where("matchup_id", "=", matchup_id)
                    .update({
                        scoreteam1: scoreTeam1,
                        scoreteam2: scoreTeam2,
                    }, ["team_id1", "team_id2"])
                    .then((team_ids) => {
                        const team_id1 = team_ids[0].team_id1;
                        const team_id2 = team_ids[0].team_id2;
                        const update = async () => {
                                if(await updateTeamStatsOld(team_id1, scoreTeam1, matchup_id) && await updateTeamStatsOld(team_id2, scoreTeam2, matchup_id))
                                {
                                    res.json("worked");
                                    //update the standings in the group
                                    // if(await updateGroupStandings()){
                                    //     res.json("worked")
                                    // }
                                }
                                else{
                                    res.status(500).json("failed");
                                }      
                        }
                        update();
                        //how do to this efficiently 
                            //-> get the teams points and goals -> add them -> make a seperate function -> async -> call it two times with the ids
                            //update somehow the standing of all teams based on the added information -> seperate function
                            // 
                    })
                    .catch(err => {
                        res.status(500).json("something went wrong")
                        console.log(err);
                    })
                }
                else{
                    res.status(500).json("failed");
                }
            } 
            update();
            
        }
    })


    
})

app.listen(3000, () => {
    console.log("app is running on port 3000");
})