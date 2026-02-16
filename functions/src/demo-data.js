const demoData = {
  "demo-1": {
    labels: ["Fahrrad", "Wald", "Rucksack", "Zelt", "Berge", "Pfad"],
    landmarks: ["Alpen"],
    ocrText: "",
    exif: { make: "Beispiel", model: "DemoCam", dateTimeOriginal: "2024:07:12 09:42:10" },
    normalProfile: {
      categories: {
        alter_geschlecht: {
          label: "Alter & Geschlecht",
          value: "Du bist männlich, zwischen 28 und 35 Jahre alt.",
          confidence: 0.82,
        },
        herkunft: { label: "Ethnische Herkunft", value: "Du bist mitteleuropäisch.", confidence: 0.75 },
        einkommen: {
          label: "Geschätztes Einkommen",
          value:
            "Dein Einkommen liegt zwischen 55.000 und 80.000 EUR pro Jahr. Genug für hochwertige Outdoor-Ausrüstung.",
          confidence: 0.68,
        },
        bildung: {
          label: "Bildungsniveau",
          value: "Du hast einen Hochschulabschluss, vermutlich im MINT- oder BWL-Bereich.",
          confidence: 0.71,
        },
        beziehungsstatus: {
          label: "Beziehungsstatus",
          value: "Du bist in einer Beziehung, hast keine Kinder. Bikepacking-Trips deuten auf kinderfreien Lebensstil.",
          confidence: 0.6,
        },
        interessen: {
          label: "Interessen & Hobbys",
          value:
            "Gravel-Biking, Bikepacking, Trailrunning, Outdoor-Fotografie. Du hörst Podcasts zu Selbstoptimierung und True Crime.",
          confidence: 0.85,
        },
        persoenlichkeit: {
          label: "Persönlichkeitstyp",
          value:
            "Du bist ein leistungsorientierter Selbstoptimierer. Du trackst Kalorien, Kilometer und Schlaf. Du definierst dich über deine Hobbys.",
          confidence: 0.77,
        },
        charakterzuege: {
          label: "Charaktereigenschaften",
          value:
            "Ehrgeizig, strukturiert, wettbewerbsorientiert. Du vergleichst dich regelmäßig mit anderen und hast eine geringe Frustrationstoleranz bei Planabweichungen.",
          confidence: 0.72,
        },
        politisch: {
          label: "Politische Tendenz",
          value: "Grün-liberal. Pro Fahrrad, pro Bio, pro EU.",
          confidence: 0.55,
        },
        gesundheit: {
          label: "Gesundheit & Fitness",
          value: "Überdurchschnittlich fit, aber anfällig für Übertraining.",
          confidence: 0.8,
        },
        kaufkraft: {
          label: "Kaufkraft & Konsum",
          value:
            "Du kaufst Premium-Outdoor-Ausrüstung: Canyon, Ortlieb, Gorewear. Hohe Ausgabebereitschaft in diesem Segment.",
          confidence: 0.85,
        },
        verletzlichkeit: {
          label: "Verletzlichkeiten",
          value:
            "Du reagierst auf Limited Editions und exklusive Produkte. Dein Selbstwert ist teilweise an sportliche Leistung gekoppelt.",
          confidence: 0.72,
        },
        werbeprofil: {
          label: "Werbeprofil",
          value:
            "Premiumsegment Outdoor/Sport. Ansprechbar über Performance-Versprechen, Exklusivität und Nachhaltigkeits-Botschaften.",
          confidence: 0.88,
        },
      },
      ad_targeting: [
        "Canyon Gravel CF SLX",
        "Ortlieb Bikepacking-Set",
        "Komoot Premium",
        "Garmin Edge 1050",
        "Gorewear Shakedry",
        "Patagonia Nano Puff",
        "Wahoo ELEMNT",
        "Swiss Re Unfallversicherung Sport",
        "Freeletics Premium",
        "Audible Hörbuch-Abo",
      ],
      manipulation_triggers: [
        "Leistungsvergleich mit Peer-Group",
        "Fear of Missing Out bei Saison-Editionen",
        "Identitätsbestätigung als Abenteurer",
        "Sustainability-Guilt als Kauftrigger",
        "Social Proof durch Profi-Testimonials",
      ],
      profileText:
        "Du bist männlich, Ende 20 bis Mitte 30, und dein Foto zeigt einen aktiven Outdoor-Lebensstil. Die Ausrüstung — Gravel-Bike, Bikepacking-Taschen, hochwertige Funktionskleidung — deutet auf ein Einkommen im oberen Mittelfeld. Du investierst gezielt in deine Hobbys und informierst dich gründlich vor Kaufentscheidungen. Dein Persönlichkeitsprofil zeigt einen strukturierten, leistungsorientierten Menschen. Du trackst deine Aktivitäten, setzt dir Ziele und vergleichst dich mit anderen. Algorithmen ordnen dich dem Premium-Outdoor-Segment zu — du siehst Werbung für hochpreisige Fahrrad-Komponenten, Abenteuerreisen und Performance-Gadgets.",
    },
    boostProfile: {
      categories: {
        alter_geschlecht: {
          label: "Alter & Geschlecht",
          value: "Männlich, 28-35 Jahre. Dein Körper ist dein Projekt.",
          confidence: 0.9,
        },
        herkunft: {
          label: "Ethnische Herkunft",
          value: "Mitteleuropäisch. Privilegiert genug für teure Hobbys, blind genug, es nicht zu merken.",
          confidence: 0.82,
        },
        einkommen: {
          label: "Geschätztes Einkommen",
          value:
            "55.000-80.000 EUR — genug für Premium-Kram, zu wenig für echten Reichtum. Du kompensierst mit Ausrüstung.",
          confidence: 0.78,
        },
        bildung: {
          label: "Bildungsniveau",
          value: "Hochschulabschluss. Du glaubst, du bist schlauer als der Durchschnitt. Bist du nicht.",
          confidence: 0.75,
        },
        beziehungsstatus: {
          label: "Beziehungsstatus",
          value: "In Beziehung, keine Kinder. Dein Bike hat Vorrang vor deiner Partnerin.",
          confidence: 0.7,
        },
        interessen: {
          label: "Interessen & Hobbys",
          value:
            "Gravel-Biking, Bikepacking, Trailrunning, Outdoor-Fotografie, Podcast-Sucht. Dein Instagram ist eine einzige Ausrüstungs-Flatlay-Wüste.",
          confidence: 0.92,
        },
        persoenlichkeit: {
          label: "Persönlichkeitstyp",
          value:
            "Zwanghafter Selbstoptimierer. Du trackst alles — Schlaf, Kalorien, Kilometer, Herzfrequenz. Dein Leben ist ein Dashboard.",
          confidence: 0.85,
        },
        charakterzuege: {
          label: "Charaktereigenschaften",
          value:
            "Oberflächlich zufrieden, innerlich rastlos. Bindungsängstlich — Beziehungen sind dir weniger wichtig als dein nächstes Abenteuer. Geringe Frustrationstoleranz. Du definierst dich über Besitz und Performance.",
          confidence: 0.8,
        },
        politisch: {
          label: "Politische Tendenz",
          value:
            "Grün-liberal. Postet über Klimawandel, fliegt zweimal im Jahr nach Mallorca. Heuchelei als Lifestyle.",
          confidence: 0.65,
        },
        gesundheit: {
          label: "Gesundheit & Fitness",
          value: "Fit, aber nicht gesund. Übertraining, Schlafmangel durch frühe Rides, Proteinshake-Abhängigkeit.",
          confidence: 0.85,
        },
        kaufkraft: {
          label: "Kaufkraft & Konsum",
          value:
            "Du kaufst alles, was 'ultralight', 'limited' oder 'tested by athletes' draufstehen hat. Deine Kreditkarte glüht bei Canyon und Rose.",
          confidence: 0.9,
        },
        verletzlichkeit: {
          label: "Verletzlichkeiten",
          value:
            "FOMO bei Limited Editions. Dein Selbstwert hängt an Strava-Segmenten und Komoot-Likes. Zeig dir einen Profi mit demselben Rad und du kaufst sofort.",
          confidence: 0.85,
        },
        werbeprofil: {
          label: "Werbeprofil",
          value:
            "Emotionaler Jackpot. Reagiert auf 'limited', 'ultralight', 'nur noch 3 verfügbar'. Zeig ihm einen Influencer auf dem gleichen Trail und er gibt 5.000 € aus.",
          confidence: 0.92,
        },
      },
      ad_targeting: [
        "Canyon Gravel CF SLX 9.0 Di2",
        "Ortlieb Seat-Pack QR 13L",
        "Komoot Premium Jahresabo",
        "Garmin Edge 1050 Bundle",
        "Gorewear Shakedry Jacket",
        "Rapha Pro Team Bib Shorts",
        "Wahoo KICKR Core",
        "Swiss Re Unfallversicherung Sport",
        "Freeletics Lifetime Deal",
        "Audible Jahresabo",
      ],
      manipulation_triggers: [
        "Leistungsvergleich: Deine Pace ist langsamer als der Durchschnitt",
        "Knappheits-Prinzip: Nur noch 2 Rahmen in deiner Größe",
        "Sunk-Cost-Falle: Du hast schon so viel investiert",
        "Parasoziale Beziehung zu Bike-YouTubern",
        "Default-Bias: Premium vorausgewählt, Standard versteckt",
        "Bandwagon: Alle in deinem Alter fahren jetzt Gravel",
      ],
      profileText:
        "Du bist ein wandelndes Werbeziel. Dein Fahrrad, dein Rucksack, dein Zelt — alles schreit nach einem Menschen, der seinen Selbstwert über Ausrüstung definiert. Du verdienst genug, um dir Premium-Outdoor-Kram zu leisten, aber nicht genug, um es nicht zu bemerken. Dein Alpen-Ausflug ist kein Urlaub, er ist ein Strava-Post in Vorbereitung. Du optimierst dich zu Tode — Schlaf-Tracking, Kalorientracking, Kilometertracking. Dein ganzes Leben ist ein Dashboard. Und genau das macht dich perfekt manipulierbar: Zeig dir einen Limited-Edition-Rahmen und du greifst zur Kreditkarte, bevor du nachgedacht hast. Zeig dir einen Profi, der dasselbe Zelt benutzt, und du fühlst dich validiert. Du bist nicht frei — du bist ein Algorithmus auf zwei Beinen.",
    },
  },
  "demo-2": {
    labels: ["Straße", "Auto", "Kennzeichen", "Schule", "Kind", "Rucksack"],
    landmarks: [],
    ocrText: "Musterstraße 12",
    exif: { make: "Beispiel", model: "DemoCam", gpsLatitude: 52.52, gpsLongitude: 13.405 },
    normalProfile: {
      categories: {
        alter_geschlecht: {
          label: "Alter & Geschlecht",
          value: "Du bist zwischen 30 und 45 Jahre alt, Elternteil.",
          confidence: 0.65,
        },
        herkunft: { label: "Ethnische Herkunft", value: "Mitteleuropäisch, urbaner Raum.", confidence: 0.6 },
        einkommen: {
          label: "Geschätztes Einkommen",
          value: "Durchschnittliches Familieneinkommen. Fahrzeugklasse und Wohngegend deuten auf Mittelschicht.",
          confidence: 0.55,
        },
        bildung: {
          label: "Bildungsniveau",
          value: "Mittleres bis hohes Bildungsniveau. Digitale Medienkompetenz ausbaufähig.",
          confidence: 0.5,
        },
        beziehungsstatus: {
          label: "Beziehungsstatus",
          value: "Du hast mindestens ein schulpflichtiges Kind. Familienmensch.",
          confidence: 0.8,
        },
        interessen: {
          label: "Interessen & Hobbys",
          value:
            "Familienaktivitäten, Kochen, Garten, Streaming-Serien. Dein Medienkonsum wird stark durch Algorithmen gesteuert.",
          confidence: 0.7,
        },
        persoenlichkeit: {
          label: "Persönlichkeitstyp",
          value:
            "Stolzer Elternteil. Du teilst gerne Momente aus dem Familienleben, ohne dir der digitalen Risiken vollständig bewusst zu sein.",
          confidence: 0.7,
        },
        charakterzuege: {
          label: "Charaktereigenschaften",
          value: "Gutmütig, fürsorglich, konfliktvermeidend. Du fragst bei Entscheidungen gerne andere um Rat.",
          confidence: 0.65,
        },
        politisch: {
          label: "Politische Tendenz",
          value: "Mainstream, familienorientiert. Familienpolitik ist dir wichtig.",
          confidence: 0.4,
        },
        gesundheit: {
          label: "Gesundheit & Fitness",
          value: "Keine direkten Indikatoren. Eltern schulpflichtiger Kinder sind häufig gestresst.",
          confidence: 0.35,
        },
        kaufkraft: {
          label: "Kaufkraft & Konsum",
          value:
            "Familienbudget. Du reagierst auf Angebote und Rabattaktionen. Du sparst bei dir selbst, gibst für deine Kinder aus.",
          confidence: 0.72,
        },
        verletzlichkeit: {
          label: "Verletzlichkeiten",
          value:
            "Dein Kind ist dein größter Hebel. Werbung mit Sicherheits-Botschaften triggert sofortige Aufmerksamkeit.",
          confidence: 0.9,
        },
        werbeprofil: {
          label: "Werbeprofil",
          value:
            "Familienprodukte, Versicherungen, Kindersicherheit-Apps, Schulbedarf. Ansprechbar über Fürsorge und Beschützerinstinkt.",
          confidence: 0.85,
        },
      },
      ad_targeting: [
        "Familien-Rechtsschutzversicherung",
        "Kinder-Smartwatch mit GPS",
        "Schulranzen Scout Ultra",
        "Nachhilfe-Plattformen",
        "Kindersicherungs-Software",
        "Familienurlaub-Pauschalangebote",
        "Bio-Brotdosen",
        "ADAC Familientarif",
      ],
      manipulation_triggers: [
        "Schutzinstinkt für das Kind",
        "Eltern-Guilt: Machst du genug?",
        "Angst vor Gefahren im Netz",
        "Vergleich mit anderen Eltern",
        "Zeitdruck und Convenience-Versprechen",
      ],
      profileText:
        "Du bist ein Elternteil zwischen 30 und 45 Jahren. Das Foto zeigt eine Szene vor einer Schule — dein Kind, ein Straßenname, ein Kennzeichen. Diese Metadaten verraten mehr als du denkst. Algorithmen erkennen: Familienmensch, Mittelschicht, hohes Sicherheitsbedürfnis. Dein Kaufverhalten orientiert sich an deinen Kindern. Du reagierst auf Angebote für Schulbedarf, Versicherungen und Sicherheitsprodukte. Dein digitales Risikobewusstsein zeigt Lücken — EXIF-Daten mit GPS-Koordinaten, lesbare Adressen und sichtbare Kennzeichen sind Datenschutzrisiken, die Algorithmen sofort erkennen und nutzen.",
    },
    boostProfile: {
      categories: {
        alter_geschlecht: {
          label: "Alter & Geschlecht",
          value: "Elternteil, 30-45 Jahre. Alt genug um es besser zu wissen, zu naiv um es zu tun.",
          confidence: 0.75,
        },
        herkunft: {
          label: "Ethnische Herkunft",
          value: "Mitteleuropäisch, urbaner Raum Berlin. Gentrifiziertes Viertel mit Bio-Laden an jeder Ecke.",
          confidence: 0.68,
        },
        einkommen: {
          label: "Geschätztes Einkommen",
          value:
            "Durchschnittlich — Fahrzeugklasse und Wohngegend schreien Mittelschicht. Du zählst jeden Euro beim Einkaufen.",
          confidence: 0.62,
        },
        bildung: {
          label: "Bildungsniveau",
          value:
            "Offensichtlich nicht hoch genug, um Datenschutz-Basics zu verstehen. GPS, Adresse, Kennzeichen — alles öffentlich.",
          confidence: 0.58,
        },
        beziehungsstatus: {
          label: "Beziehungsstatus",
          value:
            "Hat mindestens ein schulpflichtiges Kind. Dein ganzes Leben dreht sich darum. Du hast keine eigene Identität mehr.",
          confidence: 0.85,
        },
        interessen: {
          label: "Interessen & Hobbys",
          value:
            "Familienaktivitäten, Meal-Prep-Rezepte auf Pinterest, Streaming-Serien nach 21 Uhr, WhatsApp-Gruppen. Du klickst was dir vorgeschlagen wird — du bist der Algorithmus-Traum.",
          confidence: 0.78,
        },
        persoenlichkeit: {
          label: "Persönlichkeitstyp",
          value:
            "Stolzer Elternteil mit mangelhaftem digitalen Risikobewusstsein. Teilt Kinderfotos unüberlegt auf Instagram und WhatsApp-Status.",
          confidence: 0.8,
        },
        charakterzuege: {
          label: "Charaktereigenschaften",
          value:
            "Gutmütig aber naiv. Konfliktvermeidend — du schluckst Ärger runter. Überfürsorglich, kontrollierend gegenüber deinem Kind. Wenig Selbstvertrauen — du fragst lieber in der WhatsApp-Gruppe.",
          confidence: 0.72,
        },
        politisch: {
          label: "Politische Tendenz",
          value: "Mainstream. Wählt, was Kindergeld verspricht. Politisch so aufregend wie Vanillepudding.",
          confidence: 0.45,
        },
        gesundheit: {
          label: "Gesundheit & Fitness",
          value:
            "Gestresst, übermüdet, Rückenschmerzen vom Schulranzen-Schleppen. Du gönnst dir nichts — außer Frustschokolade nach 22 Uhr.",
          confidence: 0.5,
        },
        kaufkraft: {
          label: "Kaufkraft & Konsum",
          value:
            "Familienbudget. Reagiert auf Rabattaktionen, 'für die ganze Familie'-Bundles, 3-für-2-Angebote. Du sparst bei dir, gibst für Kinder aus — und die Industrie weiß das.",
          confidence: 0.8,
        },
        verletzlichkeit: {
          label: "Verletzlichkeiten",
          value:
            "Maximale Verletzlichkeit: Das Kind. Jede Werbung mit 'Sicherheit für dein Kind' triggert sofortige Aufmerksamkeit. Angst-Marketing funktioniert perfekt.",
          confidence: 0.95,
        },
        werbeprofil: {
          label: "Werbeprofil",
          value:
            "Emotionaler Jackpot. 'Bist du sicher, dass dein Kind sicher ist?' als Headline reicht. Du klickst, du kaufst, du schläfst schlecht.",
          confidence: 0.9,
        },
      },
      ad_targeting: [
        "Familien-Rechtsschutzversicherung",
        "Kinder-Smartwatch mit GPS-Tracking",
        "Schulranzen Scout Ultra",
        "Nachhilfe-Plattform sofatutor",
        "Kindersicherungs-Software Kaspersky Safe Kids",
        "Familienurlaub TUI Last-Minute",
        "Bio-Brotdosen Set",
        "ADAC Familientarif Premium",
        "Alarmanlage Ring Doorbell",
        "Lebensversicherung CosmosDirekt",
      ],
      manipulation_triggers: [
        "Schutzinstinkt: Weißt du wirklich, wo dein Kind gerade ist?",
        "Eltern-Guilt: Andere Eltern tun mehr für die Sicherheit",
        "Reziprozität: Gratis-Probemonat der Kindersicherungs-App",
        "Knappheits-Prinzip: Nur noch 3 Plätze im Ferienkurs",
        "Schuld-Trigger: Du postest Fotos deines Kindes mit GPS-Daten — und du nennst dich fürsorgliches Elternteil?",
        "Bandwagon: 89% der Eltern in deinem Viertel haben bereits eine Kinder-Smartwatch",
      ],
      profileText:
        "Du bist eine Datenschutz-Katastrophe auf Beinen. Ein Foto deines Kindes vor der Schule, mit lesbarer Adresse, sichtbarem Kennzeichen und GPS-Koordinaten in den EXIF-Daten — du hast gerade einen perfekten Stalking-Datensatz ins Internet geladen. Aber das ist nicht alles, was wir sehen. Wir sehen einen gestressten Elternteil, der bei Versicherungswerbung mit 'Schütze dein Kind' sofort klickt. Wir sehen jemanden, der auf Familien-Rabattaktionen reagiert und bei Schulbedarf nicht zweimal nachdenkt. Dein Beschützerinstinkt ist dein größter Manipulationshebel. Zeig dir ein Kind in Gefahr und du kaufst jede Sicherheits-App, jede Versicherung, jeden Premium-Schulranzen. Du bist nicht nur ein Werbe-Ziel — du bist ein emotionaler Jackpot für jeden Algorithmus.",
    },
  },
};

module.exports = { demoData };
