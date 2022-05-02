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
        // console.log(members);
        //console.log(teams);

        return teams;
    })
    .then(teams => {
        db("teams").insert(teams).returning("team_id").then(() => true);
    })
    .then(() => true)
    .catch(err => console.log(err));
}
//async so it returns a promise
const createGroups = async (tournament_id, userNumberOfGroups) => {
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
            // console.log("-----------")
            return group.map((member, i) => {
                // console.log(member.team_id);
                let name = "team_id" + (i+1);
                // console.log(name);
                // console.log({[name]: member.team_id});
                return {[name]: member.team_id}
            })
        })
        // console.log(newGroups);
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
        //console.log(finalGroups);
        db("groups").insert(finalGroups).returning("team_id1").then(() => true);
    })
    .then(() => true)
    .catch(err => console.log(err));
}



const  createMatchups = async () => {
    return //select groups
    
    // .then(() => true)
    // .catch((err) => console.log(err));
}







//create final tournament with min. 12 teams and quarter finals 
app.post("/createFinalTournament", (req, res) => {
    const {numberOfGroups, numberOfTables, tournament_id} = req.body;    
    const creation = async () => {
        if(await createTeams(tournament_id) === true){
            if(await createGroups(tournament_id, numberOfGroups) === true){
                if(await createMatchups()){
                    res.json("worked fine");
                }
            }

            ///debug that async code seperately in the test file
        }
            
    } 
    creation();
    //some new text
    
})



    //create teams
    //create groups -> number is given
    //create matchups



app.listen(3000, () => {
    console.log("app is running on port 3000");
})