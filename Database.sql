CREATE TABLE user_profiles(
    user_id BIGSERIAL PRIMARY KEY,
    user_email_address VARCHAR(100) UNIQUE NOT NULL,
    user_name VARCHAR(100),
    joined TIMESTAMP
);

CREATE TABLE user_login(
    login_id BIGSERIAL PRIMARY KEY,
    login_hash VARCHAR(100) NOT NULL,
    user_email_address VARCHAR(100) NOT NULL UNIQUE REFERENCES user_profiles(user_email_address)
);

INSERT INTO user_profiles (user_email_address, user_name) VALUES ('lisa@web.de', 'Lisa');

INSERT INTO user_profiles (user_email_address, user_name) VALUES ('tom@web.de', 'Tom');

ALTER TABLE user_profiles ADD joined CURRENT_TIMESTAMP;

SELECT * FROM user_profiles;
SELECT * FROM user_login;

CREATE TABLE tournaments (
    tournament_id BIGSERIAL PRIMARY KEY,
    tournament_name VARCHAR(100) UNIQUE,
    user_id BIGINT NOT NULL REFERENCES user_profiles(user_id)
);
INSERT INTO tournaments (tournament_name, user_id) VALUES ('wilde kerle 315', 65);

CREATE TABLE members (
    member_id BIGSERIAL PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    tournament_id BIGINT NOT NULL REFERENCES tournaments(tournament_id)
);
INSERT INTO members (first_name, last_name, tournament_id) VALUES ('Nicole', 'Sieber', 45);

CREATE TABLE teams (
    team_id BIGSERIAL PRIMARY KEY,
    id_member1 BIGINT NOT NULL REFERENCES members(member_id),
    id_member2 BIGINT NOT NULL REFERENCES members(member_id),
    points INTEGER,
    goals INTEGER,
    standing SMALLINT,
    tournament_id BIGINT NOT NULL REFERENCES tournaments(tournament_id)
);

ALTER TABLE teams ADD group_id BIGINT REFERENCES groups(group_id);

CREATE TABLE groups (
    group_id BIGSERIAL PRIMARY KEY,
    team_id1 BIGINT REFERENCES teams(team_id),
    team_id2 BIGINT REFERENCES teams(team_id),
    team_id3 BIGINT REFERENCES teams(team_id),
    team_id4 BIGINT REFERENCES teams(team_id),
    team_id5 BIGINT REFERENCES teams(team_id),
    team_id6 BIGINT REFERENCES teams(team_id)
);
ALTER TABLE groups add tournament_id BIGINT NOT NULL REFERENCES tournaments(tournament_id);
