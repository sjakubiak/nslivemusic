/**
 * Real Nova Scotia venues known to host live music, open mics or sessions.
 *
 * Used to standardise venue names across sources (so dedup sees "Bearly's" and
 * "Bearly's House of Blues & Ribs" as one place) and to place events whose
 * source gives a venue name but no coordinates. Coordinates are deliberately
 * left out unless confirmed: the ingest step geocodes missing ones via
 * OpenStreetMap Nominatim and caches the result (see geocode.ts).
 *
 * Addresses come from Tourism Nova Scotia's "8 downtown Halifax pubs with live
 * music" guide and the Live Music Halifax calendar (checked 2026-11-10). Venues
 * listed with only a town were found in Taste of Nova Scotia's "Brews & Bands"
 * guides and Destination Cape Breton's live-music listings; their addresses
 * still need confirming. See docs/SOURCES.md for where each venue posts its
 * schedule.
 */
export interface RealVenue {
  name: string;
  /** Other names sources use for the same place. */
  aliases?: string[];
  address?: string;
  city: string;
  website?: string;
  latitude?: number;
  longitude?: number;
}

export const NS_VENUES: RealVenue[] = [
  // Halifax: downtown
  { name: "The Old Triangle Irish Alehouse", aliases: ["Old Triangle"], address: "5136 Prince Street", city: "Halifax", website: "https://www.oldtriangle.com/" },
  { name: "Durty Nelly's Irish Pub", aliases: ["Durty Nellys"], address: "1645 Argyle Street", city: "Halifax" },
  { name: "The Loose Cannon Scottish Public House", aliases: ["Loose Cannon"], address: "1566 Argyle Street", city: "Halifax", website: "http://theloosecannon.ca/" },
  { name: "Split Crow Pub", aliases: ["Split Crow"], address: "1855 Granville Street", city: "Halifax", website: "https://www.splitcrow.com/" },
  { name: "Bearly's House of Blues & Ribs", aliases: ["Bearlys", "Bearly's"], address: "1579 Grafton Street", city: "Halifax", website: "https://www.bearlys.ca/" },
  { name: "The Carleton", address: "1685 Argyle Street", city: "Halifax" },
  { name: "The Lower Deck", aliases: ["Lower Deck Downtown"], address: "1887 Upper Water Street", city: "Halifax" },
  { name: "Stubborn Goat Gastropub", aliases: ["Stubborn Goat"], address: "1580 Argyle Street", city: "Halifax" },
  { name: "The Auction House", address: "1726 Argyle Street", city: "Halifax", website: "https://www.auctionhousehalifax.com/" },
  { name: "Economy Shoe Shop", address: "1663 Argyle Street", city: "Halifax" },
  { name: "Barrington Steakhouse & Oyster Bar", aliases: ["Barrington Steakhouse"], address: "1662 Barrington Street", city: "Halifax" },
  { name: "Ragazzi Restobar", aliases: ["Ragazzi"], address: "5187 Salter Street", city: "Halifax" },
  { name: "Pacifico", address: "5171 George Street", city: "Halifax" },
  { name: "Obladee Wine Bar", aliases: ["Obladee"], address: "1600 Barrington Street", city: "Halifax" },
  // Halifax: north end
  { name: "The Marquee Ballroom", aliases: ["Marquee"], address: "2037 Gottingen Street", city: "Halifax", website: "https://2037gottingen.ca/" },
  { name: "The Seahorse Tavern", aliases: ["Seahorse"], address: "2037 Gottingen Street", city: "Halifax", website: "https://2037gottingen.ca/" },
  { name: "The Local", aliases: ["The Local Halifax"], address: "2037 Gottingen Street", city: "Halifax", website: "https://2037gottingen.ca/" },
  { name: "Gus' Pub & Grill", aliases: ["Gus Pub", "Gus' Pub"], address: "2605 Agricola Street", city: "Halifax" },
  { name: "Lion's Head Tavern", aliases: ["Lions Head"], address: "3085 Robie Street", city: "Halifax" },
  { name: "The Music Room", address: "6181 Lady Hammond Road", city: "Halifax" },
  // Dartmouth
  { name: "Milestones MicMac Mall", aliases: ["Milestones"], address: "21 Micmac Boulevard", city: "Dartmouth" },
  // Annapolis Valley / Hants / Colchester (addresses to confirm)
  { name: "Paddy's Brewpub", aliases: ["Paddys Pub", "Paddy's Pub"], city: "Wolfville" },
  { name: "Crystany's Brasserie", aliases: ["Crystanys"], city: "Canning", website: "https://crystanysbrasserie.com/live-music" },
  { name: "Schoolhouse Brewery", city: "Windsor", website: "https://schoolhousebrewery.ca/events/" },
  { name: "The Nook and Cranny Brew Pub", aliases: ["Nook and Cranny"], city: "Truro" },
  // South Shore / Eastern Mainland (addresses to confirm)
  { name: "Lightship Brewing", city: "Lunenburg" },
  { name: "Spindrift Brewing", city: "Antigonish" },
  // Cape Breton (addresses to confirm)
  { name: "The Red Shoe Pub", aliases: ["Red Shoe"], city: "Mabou" },
  { name: "Celtic Music Interpretive Centre", aliases: ["Celtic Music Centre"], city: "Judique" },
  { name: "Daniel's Taphouse", aliases: ["Daniels Taphouse"], city: "Sydney" },
  { name: "Frolic'n Folk", aliases: ["Frolic n Folk"], city: "Iona" },
];
