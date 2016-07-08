
-- Table: users

-- DROP TABLE users;

CREATE TABLE users
(
  username text,
  password text,
  email text,
  id serial NOT NULL,
  CONSTRAINT id_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);


-- Table: cards

-- DROP TABLE cards;

CREATE TABLE cards
(
  id integer NOT NULL,
  name text,
  mc text,
  cmc integer,
  colors text,
  types text,
  subtypes text,
  rarity character(1),
  rulestext text,
  flavortext text,
  power text,
  toughness text,
  layout integer,
  imageurl text,
  imageurl2 text,
  multiverseid integer,
  addable boolean,
  CONSTRAINT cards_pkey PRIMARY KEY (id)
)
WITH (
  OIDS=FALSE
);


-- Table: decks

-- DROP TABLE decks;

CREATE TABLE decks
(
  id integer NOT NULL,
  user_id integer,
  deckname text,
  type text,
  CONSTRAINT decks_pkey PRIMARY KEY (id),
  CONSTRAINT user_id_fkey FOREIGN KEY (user_id)
      REFERENCES users (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
)
WITH (
  OIDS=FALSE
);


-- Index: fki_user_id_fkey

-- DROP INDEX fki_user_id_fkey;

CREATE INDEX fki_user_id_fkey
  ON decks
  USING btree
  (user_id);



-- Table: decklists

-- DROP TABLE decklists;

CREATE TABLE decklists
(
  deck_id integer NOT NULL,
  card_id integer NOT NULL,
  qty integer,
  CONSTRAINT decklists_pkey PRIMARY KEY (deck_id, card_id),
  CONSTRAINT cards_id_fkey FOREIGN KEY (card_id)
      REFERENCES cards (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION,
  CONSTRAINT deck_id_fkey FOREIGN KEY (deck_id)
      REFERENCES decks (id) MATCH SIMPLE
      ON UPDATE NO ACTION ON DELETE NO ACTION
)
WITH (
  OIDS=FALSE
);

