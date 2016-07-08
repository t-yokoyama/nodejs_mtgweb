#!/usr/bin/python

import sys
import json
import time
import os.path
import urllib.request


# configurable parameters

generate_queries    = True
generate_images     = False
query_filename      = "insert_cards.sql"
temp_images_dir     = "images/"
final_images_dir    = "images/cards/"
json_dir            = "json/"

selected_sets = {

    # pre-modern: core sets
    "LEA": 100, # alpha
    "LEB": 101, # beta
    "2ED": 102, # unlimited
    "3ED": 103, # revised
    "4ED": 104, # 4th edition
    "5ED": 105, # 5th edition
    "6ED": 106, # 6th edition
    "7ED": 107, # 7th edition

    # pre-modern: expansion sets
    "ARN": 110, # arabian nights
    "ATQ": 111, # antiquities
    "LEG": 112, # legends
    "DRK": 113, # the dark
    "FEM": 114, # fallen empires
    "HML": 115, # homelands
    "ICE": 116, # ice age
    "ALL": 117, # alliances
    "MIR": 118, # mirage
    "VIS": 119, # visions
    "WTH": 120, # weatherlight
    "TMP": 121, # tempest
    "STH": 122, # stronghold
    "EXO": 123, # exodus
    "USG": 124, # urza's saga
    "ULG": 125, # urza's legacy
    "UDS": 126, # urza's destiny
    "MMQ": 127, # mercadian masques
    "NMS": 128, # nemesis
    "PCY": 129, # prophecy
    "INV": 130, # invasion
    "PLS": 131, # planeshift
    "APC": 132, # apocalypse
    "ODY": 133, # odyssey
    "TOR": 134, # torment
    "JUD": 135, # judgment
    "ONS": 136, # onslaught
    "LGN": 137, # legions
    "SCG": 138, # scourge

    # pre-modern: portal
    "POR": 150, # portal
    "PO2": 151, # portal 2
    "PTK": 152, # portal 3 kingdoms

    # pre-modern: misc
    "CHR": 160, # chronicles
    
    # post-modern: core sets
    "8ED": 200, # 8th edition
    "9ED": 201, # 9th edtion
    "10E": 202, # 10th edition
    "M10": 203, # magic 2010
    "M11": 204, # magic 2011
    "M12": 205, # magic 2012
    "M13": 206, # magic 2013
    "M14": 207, # magic 2014
    "M15": 208, # magic 2015
    "ORI": 209, # magic origins

    # post-modern: expansion sets
    "MRD": 210, # mirrodin
    "DST": 211, # darksteel
    "5DN": 212, # fifth dawn
    "CHK": 213, # champions of kamigawa
    "BOK": 214, # betrayers of kamigawa
    "SOK": 215, # saviors of kamigawa
    "RAV": 216, # ravnica
    "GPT": 217, # guildpact
    "DIS": 218, # dissension
    "CSP": 219, # coldsnap
    "TSP": 220, # time spiral
    "PLC": 221, # planar chaos
    "FUT": 222, # future sight
    "LRW": 223, # lorwyn
    "MOR": 224, # morningtide
    "SHM": 225, # shadowmoor
    "EVE": 226, # eventide
    "ALA": 227, # shards of alara
    "CONF": 228, # conflux
    "ARB": 229, # alara reborn
    "ZEN": 230, # zendikar
    "WWK": 231, # worldwake
    "ROE": 232, # rise of the eldrazi
    "SOM": 233, # scars of mirrodin
    "MBS": 234, # mirrodin besieged
    "NPH": 235, # new phyrexia
    "ISD": 236, # innistrad
    "DKA": 237, # dark ascension
    "AVR": 238, # avacyn restored
    "GTC": 239, # gatecrash
    "DGM": 240, # dragon's maze
    "THS": 241, # theros
    "BNG": 242, # born of the gods
    "JOU": 243, # journey into nyx
    "KTK": 244, # khans of tarkir
    "FRF": 245, # fate reforged
    "DTK": 246, # dragons of tarkir
    "BFZ": 247, # battle for zendikar
    "OGW": 248, # oath of the gatewatch

    # post-modern: modern masters
    "MMA": 280, # modern masters
    "MM2": 281, # modern masters 2015

    # post-modern: misc
    "TSB": 290,
    "FRF_UGIN": 291, # ugin's fate promos
    "EXP": 292, # zendikar expeditions

    # multiplayer products: commander
    "CMD": 500, # commander
    "CM1": 501, # commander's arsenal
    "C13": 502, # commander 2013
    "C14": 503, # commander 2014
    "C15": 504, # commander 2015

    # multiplayer products: misc
    "HOP": 550, # planechase
    "PC2": 551, # planechase 2012
    "ARC": 560, # archenemy
    "CNS": 570, # conspiracy

    # reprint products: duel decks
    "EVG": 600, # dd: elves vs goblins
    "DD2": 601, # dd: jace vs chandra
    "DDC": 602, # dd: divine vs demonic
    "DDD": 603, # dd: garruk vs liliana
    "DDE": 604, # dd: phyrexia vs the coalition
    "DDF": 605, # dd: elspeth vs tezzeret
    "DDG": 606, # dd: knights vs dragons
    "DDH": 607, # dd: ajani vs nicol bolas
    "DDI": 608, # dd: venser vs koth
    "DDJ": 609, # dd: izzet vs golgari
    "DDK": 610, # dd: sorin vs tibalt
    "DDL": 611, # dd: heroes vs monsters
    "DDM": 612, # dd: jace vs vraska
    "DDN": 613, # dd: speed vs cunning
    "DDO": 614, # dd: elspeth vs kiora
    "DDP": 615, # dd: zendikar vs eldrazi

    # reprint products: from the vault
    "DRB": 650, # ftv: dragons
    "V09": 651, # ftv: exiled
    "V10": 652, # ftv: relics
    "V11": 653, # ftv: legends
    "V12": 654, # ftv: realms
    "V13": 655, # ftv: twenty
    "V14": 656, # ftv: annihilation
    "V15": 657, # ftv: angels

    # reprint products: premium deck series
    "H09": 670, # pds: slivers
    "PD2": 671, # pds: fire and lightning
    "PD3": 672, # pds: graveborn

    # non-serious    
    "UGL": 900, # unglued
    "UNH": 901, # unhinged    
}

mid_blacklist = [

195179, # zen full-art plains
201972, # zen full-art plains
201974, # zen full-art plains
195163, # zen full-art plains
201966, # zen full-art island
201964, # zen full-art island
201963, # zen full-art island
195170, # zen full-art island
201977, # zen full-art swamp
201978, # zen full-art swamp
195159, # zen full-art swamp
195157, # zen full-art swamp
201968, # zen full-art mountain
201967, # zen full-art mountain
201969, # zen full-art mountain
201970, # zen full-art mountain
195158, # zen full-art forest
201962, # zen full-art forest
201960, # zen full-art forest
195183, # zen full-art forest

401992, # bfz full-art plains
401993, # bfz full-art plains
401991, # bfz full-art plains
401994, # bfz full-art plains
401990, # bfz full-art plains
401925, # bfz full-art island
401923, # bfz full-art island
401926, # bfz full-art island
401927, # bfz full-art island
401921, # bfz full-art island
402061, # bfz full-art swamp
402058, # bfz full-art swamp
402060, # bfz full-art swamp
402059, # bfz full-art swamp
402062, # bfz full-art swamp
401962, # bfz full-art mountain
401959, # bfz full-art mountain
401956, # bfz full-art mountain
401961, # bfz full-art mountain
401960, # bfz full-art mountain
401889, # bfz full-art forest
401888, # bfz full-art forest
401891, # bfz full-art forest
401886, # bfz full-art forest
401890, # bfz full-art forest
407694, # bfz full-art wastes
407696  # bfz full-art wastes
]

# global variables
query_file = None
numbering_auto = False
numbering_manual = False
numbering_dict = {}


# supporting methods

def formatTextForPostgres(text):

    if len(text) == 0:
        return "''"

    raw = ("%r" % text)    
    raw = raw[1:-1]
    raw = raw.replace('\\"', '"')
    raw = raw.replace("\\'", "'")            
    raw = raw.replace("'", "''")
    return "".join(["'", raw, "'"])


def cardToQuery(card, cid, image1_cid, image2_cid, exp, addable):
    
    # id integer
    field_id = str(cid)

    #  name text
    field_name = formatTextForPostgres(card["name"])

    # mc text
    field_mc = "'%s'" % card.get("manaCost", "")
    
    # cmc integer
    field_cmc = str(card.get("cmc", 0))
    
    # colors text
    w = '-'
    u = '-'
    b = '-'
    r = '-'
    g = '-'
    color_array = card.get("colors",[])
    if color_array:
        if "White" in color_array:
            w = 'W'
        if "Blue" in color_array:
            u = 'U'
        if "Black" in color_array:
            b = 'B'
        if "Red" in color_array:
            r = 'R'
        if "Green" in color_array:
            g = 'G'
    field_colors = "'%s'" % "".join([w, u, b, r, g])
    
    # types text
    field_types = formatTextForPostgres(" ".join(card["types"]))
    
    # subtypes text
    field_subtypes = "'%s'" % " ".join(card.get("subtypes",[]))
    
    # rarity character(1)
    field_rarity = "'%s'" % card["rarity"][0]
    
    # rulestext text
    field_rulestext = formatTextForPostgres(card.get("text", ""))

    # flavortext text
    field_flavortext = formatTextForPostgres(card.get("flavor", ""))
    
    # power integer
    field_power = "'%s'" % card.get("power", "")
    
    # toughness integer
    field_toughness = "'%s'" % card.get("toughness", "")
    
    # layout integer
    field_layout = str(layoutToCode(card["layout"]))
    
    # imageurl text
    field_imageurl = "'%s'" % (final_images_dir + str(image1_cid) + ".jpg")
    
    # imageurl2 text
    field_imageurl2 = "NULL"
    if image2_cid != 0:
        field_imageurl2 = "'%s'" % (final_images_dir + str(image2_cid) + ".jpg")

    # multiverseid integer
    field_multiverseid = "%s" % card["multiverseid"]

    # addable boolean
    field_addable = "TRUE" if addable else "FALSE"

    data = ", ".join([
        field_id,
        field_name,
        field_mc,
        field_cmc,
        field_colors,
        field_types,
        field_subtypes,
        field_rarity,
        field_rulestext,
        field_flavortext,
        field_power,
        field_toughness,
        field_layout,
        field_imageurl,
        field_imageurl2,
        field_multiverseid,
        field_addable
        ])

    query = "".join([
        "INSERT INTO cards VALUES (",
        data,
        ");"
        ])

    return query


def letterToDigit(x):
    return {
        'a': 1,
        'b': 2,
        'c': 3,
        'd': 4,
        'e': 5
    }.get(x, 0)


def layoutToCode(x):
    return {
        'normal': 0,
        'leveler': 0,
        'split': 1,
        'flip': 2,
        'double-faced': 3
    }.get(x, -1)


def processCard(card, exp):

    global numbering_auto
    global numbering_manual
    global numbering_dict

    # skip certain card layouts
    layout = card["layout"]
    if layout in ["token", "scheme", "plane", "phenomenon"]:
        return

    # use card number if it exists in the json, but otherwise manually
    # generate one by keeping a dictionary of all the card names seen
    # so far within the expansion set; also make sure not to mix auto
    # and manual numbering within a set
    cnum = 0
    lnum = 0
    cnum_str = card.get("number", None)
    if cnum_str != None:
        numbering_auto = True
        if numbering_manual:
            print("Error: Card with card number encountered in manual numbering mode.")
            return
    else:
        numbering_manual = True
        if numbering_auto:
            print("Error: Card without card number encountered in auto numbering mode.")
            return
        cnum_str = numbering_dict.get(card["name"], None)
        if cnum_str == None:
            cnum_str = str(len(numbering_dict) + 1) + "a"
            numbering_dict[card["name"]] = cnum_str
        else:
            cnum_str = cnum_str[:-1] + chr(ord(cnum_str[-1]) + 1)
            numbering_dict[card["name"]] = cnum_str
        # print("Generated card num: %s for card %s." % (cnum_str, card["name"]))

    # a handful of cards use an unsupported card number format, just drop these
    if not cnum_str[0].isdigit():
        print("Skipping card %s with invalid card number %s." % (card["name"], cnum_str))
        return

    # separate the card number into a card code and letter code
    if cnum_str[-1].isdigit():
        cnum = int(cnum_str)
        lnum = 1
    else:
        cnum = int(cnum_str[:-1])
        lnum = letterToDigit(cnum_str[-1])

    # this is a hack to deal with duplicate card numbers; drift the cid of
    # the full-art versions of zen/bfz lands so they have unique cids
    if card["multiverseid"] in mid_blacklist:
        lnum += 1

    # generate a 7 digit card id using the set, card code and letter code
    cid = selected_sets[exp] * 10000 + cnum * 10 + lnum
    a_cid = selected_sets[exp] * 10000 + cnum * 10 + 1
    b_cid = selected_sets[exp] * 10000 + cnum * 10 + 2

    # processing strategy depends on card layout
    
    image1_cid = 0
    image2_cid = 0
    addable = False
    needs_image = False

    if layout == "flip":
        image1_cid = a_cid
        image2_cid = 0
        if lnum == 1:
            addable = True
            needs_image = True
        else:
            addable = False
            needs_image = False

    elif layout == "split":
        image1_cid = a_cid
        image2_cid = 0
        if lnum == 1:            
            addable = True
            needs_image = True
        else:
            addable = False
            needs_image = False

    elif layout == "double-faced":
        if lnum == 1:
            image1_cid = a_cid
            image2_cid = b_cid
            addable = True
            needs_image = True
        else:
            image1_cid = b_cid
            image2_cid = 0
            addable = False
            needs_image = True

    elif layout == "normal" or layout == "leveler":
        image1_cid = cid
        image2_cid = 0
        addable = True
        needs_image = True

    else:
        print("Unknown card layout type: " + layout)
        return

    # extract all info from the card's json, convert it to an insert query
    if generate_queries:
        query = cardToQuery(card, cid, image1_cid, image2_cid, set_key, addable)
        query_file.write(query + "\n")

    # retrieve the image for the card from the gatherer website
    if generate_images:
        if needs_image:
            image_path = temp_images_dir + str(cid) + ".jpg"
            if not os.path.exists(image_path):
                urllib.request.urlretrieve(
                    "http://gatherer.wizards.com/Handlers/Image.ashx?multiverseid=%d&type=card" % card["multiverseid"],
                    image_path)

# 'main'

print("executing MTGJSON decoder...")

if generate_queries:
    try:
        query_file = open(query_filename, 'w', encoding = "utf8")
    except:
        print("Failed to open file %s." % query_filename)
        sys.exit(1)

for set_key in sorted(selected_sets):

    with open(json_dir + "%s.json" % set_key, 'r', encoding = "utf8") as set_file:

        print("parsing " + set_file.name)
        set_data = json.load(set_file);
        num_cards = len(set_data["cards"])

        numbering_auto = False
        numbering_manual = False
        numbering_dict.clear()

        for i in range(0, num_cards):
            processCard(set_data["cards"][i], set_key)

        set_file.close()


if generate_queries:
    query_file.close()

