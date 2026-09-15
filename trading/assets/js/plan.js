/* =========================================================
   plan.js — Plan de trading (contenu + suivi de discipline)
   Marché : forex & indices CFD — horizon intraday / swing
   ========================================================= */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------
     Contenu du plan (modifiable directement ici)
     --------------------------------------------------------- */
  var PLAN = {
    version: '2.0',
    title: 'Plan de trading — SMV',
    subtitle: 'Smart Money Vision · Ultra FX — forex & indices CFD',
    updated: 'Septembre 2026',
    mission: "Surfer le mouvement des big boyz : lire la structure, attendre les confirmations optimales en HTF et LTF, puis exécuter mes setups avec un risque fixe et une exécution notée. Objectif : appartenir aux 80 % qui suivent la tendance, pas aux 20 % qui la subissent.",

    blocks: [
      /* ---------- 1 ---------- */
      {
        id: 'cadre',
        num: '01',
        title: 'Identité de trading',
        lead: 'Qui je suis en tant que trader SMV, et dans quel cadre je travaille.',
        items: [
          { type: 'kv', rows: [
            ['Méthode', 'SMV — Smart Money Vision (structure, offre/demande, cause à effet, liquidité)'],
            ['Marché', 'Forex majeurs, or (XAUUSD), indices (US30, NAS100)'],
            ['Style', 'Intraday sur les fenêtres de tir, swing court en complément sur les prises de position Wyckoff'],
            ['Lecture', 'HTF = biais directionnel et zones majeures · LTF = prise de liquidité, ChoCh, BOS, entrée'],
            ['Fenêtres de tir', 'Asie 1h–2h · Europe 8h–9h · USA 13h–14h (heure de Bamako, fuseau du Mali)'],
            ['Instrument type', '1 à 3 instruments suivis par semaine, pas plus'],
            ['Unité de risque', 'R = 1 % du capital maximum par trade']
          ]},
          { type: 'callout', tone: 'gold', title: 'Mon edge en une phrase',
            text: "Je lis d'abord la structure en HTF pour connaître le biais et repérer mes zones d'offre et de demande. J'attends ensuite en LTF la prise de liquidité, le ChoCh et le BOS, puis j'entre au retest de la zone avec un stop serré. Mon rendement vient du ratio (1:7 minimum), pas du taux de réussite." },
          { type: 'list', title: 'Les 4 lois — socle non négociable', items: [
            'La structure : elle me donne la direction. Sans biais de structure, je ne prends pas de trade.',
            "L'offre et la demande : elles me donnent les zones où se sont placés les big boyz.",
            'Cause à effet : les mouvements partent de périodes de préparation (accumulation ou distribution).',
            'La liquidité : chaque high/low non manipulé est une cible. Je la traque, je ne la fournis pas.'
          ]},
          { type: 'note', text: "Tout trade qui ne peut pas être décrit par les 6 lignes d'un setup (section 04) et rattaché à une des 4 lois n'est pas pris. Point." }
        ]
      },

      /* ---------- 2 ---------- */
      {
        id: 'objectifs',
        num: '02',
        title: 'Objectifs & jalons',
        lead: "Le processus d'abord (ce que je contrôle), la performance ensuite (ce qui en découle).",
        items: [
          { type: 'cards', cards: [
            { icon: 'plan', title: 'Objectif processus', value: '≥ 90 %', sub: 'de trades notés « plan respecté » chaque mois' },
            { icon: 'dashboard', title: 'Objectif performance', value: '+5 % / mois', sub: 'avec un ratio moyen ≥ 1:7 et un drawdown sous 10 %' },
            { icon: 'journal', title: 'Objectif compétence', value: '50 trades revus', sub: 'chaque trimestre, avec statistiques par setup' }
          ]},
          { type: 'table',
            head: ['Période', 'Objectif de performance', 'Objectif de processus', 'Critère de réussite'],
            rows: [
              ['Mois 1', '0 % (ne pas perdre)', '10 à 15 trades notés', 'Aucune règle de risque violée, journal rempli à 100 %'],
              ['Mois 2–3', '+2 à +4 % / mois', '≥ 90 % de trades conformes', 'Espérance en R positive sur ≥ 20 trades'],
              ['Mois 4–6', '+4 à +5 % / mois', '10 trades max / semaine', 'Profit factor > 1,3 et drawdown max < 8 %'],
              ['Mois 7–12', '+5 % / mois', '1 revue écrite / semaine', 'Ratio moyen ≥ 1:7 tenu sur 100 trades']
            ]},
          { type: 'list', title: "Conditions d'arrêt (kill switch) — non négociables", items: [
            '2 stop loss pris dans la journée : la journée est terminée, sans exception.',
            'Perte de 6 % du capital sur la semaine : arrêt jusqu\'au lundi suivant.',
            'Perte de 10 % depuis le plus haut : retour en taille réduite (50 %) pendant 10 trades conformes.',
            '3 trades consécutifs hors plan : arrêt 48 h + revue écrite avant de reprendre.',
            'Fatigue, maladie, conflit personnel majeur : pas de trading ce jour-là.'
          ]}
        ]
      },

      /* ---------- 3 ---------- */
      {
        id: 'risque',
        num: '03',
        title: 'Règles de risque & money management',
        lead: 'Le risque est la seule variable que je contrôle à 100 %.',
        items: [
          { type: 'kv', rows: [
            ['Risque par trade', '1 % du capital maximum (fourchette 0,25 % – 1 %)'],
            ['Stop loss', '15 pips maximum, jamais élargi'],
            ['Ratio minimum', '1:7 (risque 1 pour viser 7)'],
            ['Stop loss par jour', '2 maximum — le deuxième est le dernier'],
            ['Mise à breakeven', "Dès la cassure d'un high/low (BOS) en ma faveur"],
            ['Prises partielles', 'Target 1 : 30 % · Target 2 : 50 % · Target 3 : le solde (dernier palier)'],
            ['Levier', 'Jamais de taille calculée « au feeling » : elle sort de la formule ci-dessous']
          ]},
          { type: 'formula', title: 'Taille de position', lines: [
            'Risque en devise (R) = Capital × 1 %',
            'Distance au stop (pips) = |Entrée − Stop| ÷ valeur du pip',
            'Taille (lots) = Risque en devise ÷ (Distance en pips × valeur du pip par lot)',
            'Exemple : capital 10 000 € → R = 100 €. Stop à 12 pips, pip à 10 €/lot → 100 ÷ (12 × 10) = 0,83 lot.'
          ]},
          { type: 'table',
            head: ['Palier', 'Ce que je fais', 'Pourquoi'],
            rows: [
              ['Breakeven', "Je déplace le stop au prix d'entrée dès que le BOS confirme", 'Je ne laisse plus une position gagnante redevenir perdante'],
              ['Target 1 (30 %)', 'Je sécurise 30 % à 1:2 minimum', 'Je paie le trade et je réduis la pression'],
              ['Target 2 (50 %)', 'Je sors 50 % sur le premier intact buyer/seller', 'Je prends la liquidité la plus proche'],
              ['Target 3 (solde)', 'Je laisse courir jusqu\'à la prochaine zone HTF', "C'est ce palier qui fait la performance (1:7 et plus)"]
            ]},
          { type: 'callout', tone: 'red', title: 'Les 4 interdits absolus', text: "Élargir un stop · Prendre un 3ᵉ trade après 2 stop loss · Entrer sans ChoCh ni prise de liquidité · Trader en dehors des fenêtres de tir. Aucune de ces quatre erreurs n'a de circonstance atténuante : elles sont la cause des comptes qui sautent." }
        ]
      },

      /* ---------- 4 ---------- */
      {
        id: 'setups',
        num: '04',
        title: 'Les setups autorisés',
        lead: "Trois configurations, pas une de plus. Chaque trade doit être rattachable à l'une d'elles.",
        items: [
          { type: 'setup', name: 'A — Golden Setup (Phase C de Wyckoff)',
            tag: 'Prise de position dans la cause',
            rows: [
              ['Contexte', "Une consolidation s'est installée (accumulation ou distribution) avec ses phases A et B identifiables en HTF, et mon biais mensuel est connu."],
              ['Déclencheur', "En Phase C : SPRING (accumulation) ou UTAD (distribution) — le mouvement vient chercher la liquidité laissée par le STB ou le UT."],
              ['Entrée', "Sur le retest de la zone après le SPRING/UTAD, quand le ChoCh confirme le changement de caractère en LTF."],
              ['Stop', '15 pips maximum, sous le plus bas du SPRING (ou au-dessus du plus haut de l\'UTAD).'],
              ['Objectifs', 'Target 1 sur la liquidité interne, puis targets sur les intact buyer/seller des phases A et B.'],
              ['Invalidation', "Retour dans la fourchette sans ChoCh, ou nouveau bas (SPRING avorté) : le setup n'existe plus, j'annule."]
            ]},
          { type: 'setup', name: 'B — Complexe Pull Back',
            tag: 'Continuation dans la tendance',
            rows: [
              ['Contexte', 'Tendance de structure claire (HH/HL en haussier, LH/LL en baissier) et le complexe pull back est identifiable par ses points A et B.'],
              ['Déclencheur', "Le prix revient dans le complexe pull back, après une prise de liquidité sur un inducemement (LH/HL inducement)."],
              ['Entrée', "Sur le ChoCh en LTF à l'intérieur du complexe, dans le sens de la structure dominante (les 80 %)."],
              ['Stop', '15 pips maximum, derrière le point A ou B du complexe.'],
              ['Objectifs', "L'intact buyer/seller suivant, puis l'extension de la tendance. Je laisse courir le dernier palier."],
              ['Invalidation', 'BOS contraire au complexe, ou cassure franche du point B : je passe en observation.']
            ]},
          { type: 'setup', name: 'C — Market Shift (prise de liquidité + ChoCh)',
            tag: 'Retournement / retournement fin',
            rows: [
              ['Contexte', 'Structure arrivée en fin de mouvement (perte de puissance des impulsions), avec une signature de liquidité visible (mèche marquée).'],
              ['Déclencheur', "Prise de liquidité sur un high/low majeur (intact, EQH/EQL ou trendline de liquidité), puis ChoCh qui invalide la structure précédente."],
              ['Entrée', "Je ne trade jamais la réaction directe : j'attends la confirmation, puis j'entre au retest de la zone laissée par la prise de liquidité."],
              ['Stop', '15 pips maximum, au-delà du high/low de la prise de liquidité.'],
              ['Objectifs', 'Le côté opposé de la fourchette, puis les intact de la structure précédente.'],
              ['Invalidation', "Pas de ChoCh après la prise de liquidité, ou retour du prix au-delà du niveau balayé : je reste spectateur."]
            ]},
          { type: 'setup', name: 'D — ODF (entrée ratée)',
            tag: 'Second passage',
            rows: [
              ['Contexte', 'Mon setup était valide, le prix est parti sans moi (entrée manquée sur le golden setup ou le market shift).'],
              ['Déclencheur', "Retour du prix sur la zone d'origine après le mouvement manqué (OFD)."],
              ['Entrée', 'Sur le retest de la zone, avec confirmation LTF — jamais en poursuite du marché.'],
              ['Stop', '15 pips maximum, derrière la zone.'],
              ['Objectifs', 'Les mêmes que le setup initial, avec un premier palier plus court.'],
              ['Invalidation', "Prix qui ne revient pas dans la zone : j'oublie le trade et j'attends le suivant."]
            ]},
          { type: 'note', text: "Chaque setup doit atteindre 20 trades avant d'être jugé. Avant ce seuil : aucune conclusion, aucune modification du plan — on exécute et on mesure. Les modules « Concept Entry » et « Raffinage PE/SL » restent à documenter ici (ils ne figuraient pas dans les documents fournis)." }
        ]
      },

      /* ---------- 5 ---------- */
      {
        id: 'structure',
        num: '05',
        title: 'Loi 1 — La structure is queen',
        lead: "La structure est mon indicateur directionnel : elle me dit si je surfe les 80 % (continuation) ou les 20 % (correction).",
        items: [
          { type: 'table',
            head: ['Structure', 'Ce que je vois', 'Ma décision'],
            rows: [
              ['Bullish', 'Des hauts de plus en plus hauts (HH) et des bas de plus en plus hauts (HL)', "Je cherche des achats sur les HL — c'est là que se placent les big boyz"],
              ['Bearish', 'Des hauts de plus en plus bas (LH) et des bas de plus en plus bas (LL)', 'Je cherche des ventes sur les LH'],
              ['Consolidation', 'Le prix évolue dans une fourchette, direction non encore donnée', "Je n'anticipe pas : j'attends les prises de liquidité et le BOS"]
            ]},
          { type: 'table',
            head: ['Type de BOS', 'Ce qu\'il signifie', 'Ce que je fais'],
            rows: [
              ['Classique / changement de tendance', "Cassure de structure qui montre un arrêt de la tendance et une intention inverse"],
              ['Continuation', 'La structure dominante est respectée et prolongée', 'Je cherche une continuation dans le sens du biais'],
              ['Trap / fake BOS', "Fausse cassure destinée à piéger les vendeurs ou les acheteurs", 'Aucune entrée : je note le piège et j\'attends le ChoCh']
            ]},
          { type: 'kv', rows: [
            ['Structure majeure', 'Se valide par un high au-dessus du high précédent (ou un low sous le low précédent)'],
            ['Structure mineure', 'Mouvement à l\'intérieur de la structure majeure — sert au timing, pas au biais'],
            ['Objectif premier', 'Acheter sur les plus bas (HL), vendre sur les plus hauts (LH) : faire partie des 80 %'],
            ['Les 20 %', "Je peux les trader (retracements), mais en sachant que ça ne dure pas — et sans jamais perdre de vue les 80 %"],
            ['Hedging concept', 'Être positionné sur l\'impulsion et le retracement en même temps : réservé aux setups parfaitement lus']
          ]},
          { type: 'note', text: "En cas de doute sur la structure : pas de trade. Un biais flou est déjà une perte." }
        ]
      },

      /* ---------- 6 ---------- */
      {
        id: 'offre-demande',
        num: '06',
        title: "Lois 2 & 3 — Offre/demande et cause à effet",
        lead: "Les zones où se sont placés les big boyz, et les périodes de préparation qui précèdent les mouvements.",
        items: [
          { type: 'kv', rows: [
            ['Offre (OB/POI)', "Zone délimitée sur un high par une bougie manipulatrice et/ou une bougie qui prend l'argent. Sur les zones d'offre : je vends."],
            ['Demande (OB/POI)', "Zone délimitée sur un low par une bougie manipulatrice et/ou une bougie qui prend l'argent. Sur les zones de demande : j'achète."],
            ['Order flow', "Enchaînements de mitigations : une nouvelle bougie manipulatrice vient récupérer la précédente."],
            ['Breaker bloc', "Polarité inversée : une offre qui devient demande, ou l'inverse."],
            ['Équations de Wyckoff', 'Demande > Offre = hausse · Demande < Offre = baisse · Demande = Offre = cause qui se met en place']
          ]},
          { type: 'note', text: "Cause à effet : une période d'accumulation (cause) conduit à une tendance haussière (effet) ; une distribution conduit à une baisse. Mon travail : repérer la cause AVANT que l'effet ne soit visible, c'est-à-dire prendre position en Phase C." },
          { type: 'table',
            head: ['Phase', 'Ce qui se passe', 'Mon attention'],
            rows: [
              ['A — Arrêt de la tendance', 'Un évènement de climax stoppe le mouvement en cours et élargit la fourchette', 'Je délimite la fourchette de travail'],
              ['B — Construction de la cause', 'Consolidation : les zones d\'offre et de demande sont testées et la liquidité se renforce', 'Je note les niveaux de liquidité qui se forment'],
              ['C — Test avec secousse', 'SPRING (accumulation) ou UTAD (distribution) vient prendre la liquidité', "C'est ici que je prends position — le cœur de mon plan"],
              ['D — Tendance dans la fourchette', 'Le prix évolue à l\'intérieur de la fourchette', "J'accompagne avec mes prises partielles"],
              ['E — Tendance hors fourchette', 'Sortie de fourchette : l\'effet est en place', 'Je laisse courir le dernier palier']
            ]},
          { type: 'kv', rows: [
            ['Accumulation', 'PS (tentative ratée d\'arrêter la baisse) · SC (arrête la baisse, crée le bas de fourchette) · AR (élargit, fixe le haut) · ST (teste la demande, renforce la liquidité) · UA (prend la liquidité de l\'AR) · STB (prend la liquidité laissée par SC et ST) · SPRING (secousse sur le STB) · SOS / BU / LPS (sortie)'],
            ['Distribution', 'PSY (tentative ratée d\'arrêter la hausse) · BC (arrête la hausse, crée le haut de fourchette) · AR (élargit, fixe le bas) · ST (teste l\'offre, renforce la liquidité) · mSOW (prend la liquidité de l\'AR) · UT (prend la liquidité laissée par BC et ST) · UTAD (secousse sur le UT) · LPSY (reprises baissières)'],
            ['Wyckoff neutre / avancé', "Consolidation où le décompte se fait haut et bas en même temps : j'attends que les liquidités externes sautent (UT ou STB) avant de réagir. Cela évite de confondre accumulation et redistribution."]
          ]}
        ]
      },

      /* ---------- 7 ---------- */
      {
        id: 'liquidite',
        num: '07',
        title: 'Loi 4 — La liquidité',
        lead: "Chaque high et low non manipulé renferme de la liquidité. C'est ma carte des cibles.",
        items: [
          { type: 'kv', rows: [
            ['Intact buyer / seller', "Hauts et bas non manipulés. Ce sont mes targets une fois positionné."],
            ['EQH / EQL', 'Plusieurs hauts ou bas au même niveau : ligne de liquidité à venir chasser.'],
            ['Trendline de liquidité', 'Plusieurs high/low reliés par une trendline : la liquidité se forme le long de la ligne.'],
            ['Signature de liquidité', "Bougie à longue mèche derrière son corps : il y a beaucoup de liquidité à aller chercher sur ce niveau."],
            ['LH/HL inducement', "Haut ou bas qui ne fait que continuer la structure sans la casser (pas de BOS) : c'est l'appât avant la vraie prise de liquidité."],
            ['Complexe pull back', "Ensemble formé par les points A et B qui arrêtent un mouvement, délimité par l'offre et la demande."],
            ['High / low du mois', "Il se crée entre le 26 et le 09 du mois. Il donne le biais directionnel du mois : je le repère avant tout autre travail."]
          ]},
          { type: 'list', title: 'Protocole liquidité avant chaque trade', items: [
            "J'identifie la liquidité que le marché doit aller chercher (intact, EQH/EQL, inducement).",
            "Je vérifie que je ne place pas mon stop dans une zone de liquidité évidente.",
            "Je cible la liquidité opposée comme objectif principal, pas un nombre de pips arbitraire.",
            "Si aucune liquidité claire ne peut servir de cible, le setup n'a pas d'objectif : je ne prends pas le trade."
          ]}
        ]
      },

      /* ---------- 8 ---------- */
      {
        id: 'outils',
        num: '08',
        title: 'Les outils de la SMV',
        lead: "Les repères techniques qui traduisent la lecture en décisions.",
        items: [
          { type: 'kv', rows: [
            ['Fibo SMC', 'Trois niveaux : 100 % · 50 % · 0 %. Au-dessus du 50 % = premium (je privilégie les ventes) ; en dessous = discount (je privilégie les achats). Le 50 % ne tient jamais : je ne m\'y fie pas comme niveau d\'entrée.'],
            ['IPA / imbalance', "Déséquilibre entre ordres d'achat et de vente : zone de retour probable du prix."],
            ['Market shift', "Réaction après un high/low qui a fait BOS. Je ne trade jamais la réaction directe : j'attends la confirmation."],
            ['Price delivery', "Lecture algorithmique du parcours du prix (IPDA) : le marché livre le prix d'un niveau à un autre."],
            ['Décompte 0-1-2-3', "0 = tentative d'arrêt qui échoue · 1 = arrêt effectif et création du failed · 2 = prise de liquidité · 3 = test de la prise de liquidité."],
            ['Vagues d\'Elliott', "4 à 5 vagues d'impulsion, avec une perte de puissance des impulsions : signe de fin de mouvement."],
            ['Fenêtres de tir', 'Asie 1h–2h · Europe 8h–9h · USA 13h–14h (heure de Bamako). Hors de ces fenêtres, je ne cherche pas d\'entrée.']
          ]},
          { type: 'table',
            head: ['Étape', 'Ce que je fais'],
            rows: [
              ['1. Biais', 'HTF : je détermine le biais de structure et je repère les zones d\'offre et de demande majeures'],
              ['2. Liquidité', "Je liste les inducemements, EQH/EQL et intact que le prix doit aller chercher"],
              ['3. Confirmation', "LTF : j'attends la prise de liquidité, puis le ChoCh qui confirme le changement de caractère"],
              ['4. Déclencheur', "BOS / intention dans le sens du biais, avec consolidation locale"],
              ['5. Entrée', 'Golden setup ou complexe pull back : entrée au retest, stop serré à 15 pips maximum'],
              ['6. Suivi', 'Breakeven à la cassure, prises partielles 30 / 50 / solde sur la liquidité suivante']
            ]},
          { type: 'note', text: "« Si entrée ratée : ODF » — le prix repart sans moi, je ne poursuis pas : j'attends le retour du prix sur la zone (voir setup D)." }
        ]
      },

      /* ---------- 9 ---------- */
      {
        id: 'routine',
        num: '09',
        title: 'Routine quotidienne',
        lead: "Le plan ne s'exécute pas à l'écran mais avant et après. Quatre moments, toujours les mêmes.",
        items: [
          { type: 'routine', title: 'Avant la séance (30 min avant la fenêtre de tir)', icon: 'calendrier', items: [
            "Je vérifie le biais du mois (high/low du mois créé entre le 26 et le 09) et le biais de la semaine.",
            "Je marque en HTF : zones d'offre et de demande majeures, inducemements, EQH/EQL, intact buyer/seller.",
            "Je note les annonces économiques dans mes fenêtres de tir.",
            "J'écris mon biais en une phrase : haussier, baissier ou consolidation — et les niveaux qui l'invalideraient."
          ]},
          { type: 'routine', title: 'Pendant la séance (fenêtres de tir uniquement)', icon: 'plan', items: [
            "J'attends la prise de liquidité, puis le ChoCh en LTF. Sans les deux, je ne fais rien.",
            "Un seul trade à la fois : j'attends d'être sorti avant d'en chercher un autre.",
            "Stop placé à 15 pips maximum avant l'entrée, jamais après.",
            "Breakeven dès la cassure d'un high/low en ma faveur ; prises partielles 30 % / 50 % / solde.",
            "Deux stop loss pris : je ferme la plateforme, même si une configuration parfaite apparaît."
          ]},
          { type: 'routine', title: 'Après la séance (17h00 – 17h30)', icon: 'journal', items: [
            "Je remplis le journal trade par trade : setup, session, émotion, erreur, capture.",
            "Je note chaque écart au plan et sa cause réelle (pas la cause confortable).",
            "Je mets à jour mes niveaux pour le lendemain (liquidité restante, zones non testées).",
            "Je vérifie mon risque cumulé de la semaine avant de savoir si je trade demain."
          ]},
          { type: 'routine', title: 'Revue hebdomadaire (dimanche, 30 min)', icon: 'dashboard', items: [
            'Je relis les trades de la semaine et je compare exécution contre plan.',
            "Je mets à jour le biais mensuel et je repère les phases de Wyckoff en cours sur mes instruments.",
            "Je calcule mes statistiques par setup : ratio moyen, taux de réussite, espérance.",
            "Aucune modification du plan tant qu'un setup n'a pas 20 trades dans le journal."
          ]}
        ]
      },

      /* ---------- 10 ---------- */
      {
        id: 'journal',
        num: '10',
        title: 'Tenue du journal',
        lead: "Un trade non journalisé est un trade qui ne m'apprendra rien.",
        items: [
          { type: 'kv', rows: [
            ['Quand', 'Immédiatement après la sortie du trade, pas le soir de mémoire'],
            ['Champs obligatoires', 'Date, instrument, session, setup, sens, entrée, stop, cible, taille, frais'],
            ['Champs de contexte', 'Émotion, erreur, respect du plan (oui / partiel / non), note écrite'],
            ['Capture', "Une image du graphique en HTF et en LTF au moment de l'entrée (lien ou référence)"],
            ['Règle', "Pas de note écrite = trade incomplet, à reprendre le soir même avant la revue"]
          ]},
          { type: 'list', title: 'Ce que je note systématiquement', items: [
            "La liquidité visée et celle qui a été prise : c'est le cœur de la méthode, je la trace à chaque trade.",
            "Le type de BOS rencontré (classique, continuation, trap) et si je l'ai correctement classé.",
            "Si le setup était un golden setup, un complexe pull back, un market shift ou un ODF.",
            "L'écart au plan chiffré en R, pas en euros : un écart vaut le même prix quelle que soit la taille."
          ]}
        ]
      },

      /* ---------- 11 ---------- */
      {
        id: 'discipline',
        num: '11',
        title: 'Discipline & récupération',
        lead: "Ce qui me protège, c'est ce que j'ai décidé avant d'être devant l'écran.",
        items: [
          { type: 'steps', steps: [
            { title: '2 stop loss dans la journée', text: "Je ferme tout. Je note les deux trades et la cause : était-ce le setup, l'exécution ou la fenêtre de tir ? Aucune reprise ce jour-là." },
            { title: '3 trades hors plan', text: "Arrêt 48 h. Je relis les 3 trades, j'écris ce qui a déclenché la sortie du cadre (fatigue, déception, ennui, revanche) et j'ajoute un garde-fou concret." },
            { title: 'Semaine négative', text: "Revue écrite de 45 min : mes pertes venaient-elles de la structure mal lue, du stop mal placé ou du marché ? Je ne change rien au plan avant 20 trades sur le setup concerné." },
            { title: 'Série gagnante', text: "Je ne change rien. Taille identique, règles identiques. C'est là que la discipline part le plus vite." },
            { title: 'Entrée ratée (ODF)', text: "Je ne poursuis pas le marché. Je note le trade manqué comme un trade à part entière : il compte dans mes statistiques de discipline." }
          ]},
          { type: 'list', title: "Signaux d'alerte personnels (si 2 sont réunis : journée off)", items: [
            "Je regarde les graphiques en dehors des fenêtres de tir.",
            "Je réduis mon stop mentalement pour « pouvoir entrer ».",
            "Je prends un trade parce que je viens d'en rater un.",
            "Je me surprends à chercher une raison d'entrer plutôt qu'une raison de ne pas entrer.",
            "Je n'ai pas écrit mon biais avant l'ouverture de la séance."
          ]},
          { type: 'callout', tone: 'gold', title: 'Ma phrase d\'ancrage', text: "Je gagne avec un ratio, pas avec un taux de réussite. Attendre la confirmation n'est pas perdre du temps, c'est le métier." }
        ]
      },

      /* ---------- 12 ---------- */
      {
        id: 'kpi',
        num: '12',
        title: 'Suivi de performance (KPI & seuils)',
        lead: "Les chiffres que je regarde, et le seuil à partir duquel j'agis.",
        items: [
          { type: 'table',
            head: ['Indicateur', 'Seuil d\'alerte', 'Décision'],
            rows: [
              ['Respect du plan', '< 85 %', 'Revue écrite obligatoire, taille réduite de moitié'],
              ['Ratio gain/perte moyen', '< 1:3', "Mes entrées sont trop tardives : je retravaille le placement (retest vs poursuite)"],
              ['Espérance par trade', '< 0 R sur 20 trades', "Arrêt du setup concerné et retour à l'étude des phases de Wyckoff"],
              ['Drawdown max', '> 10 %', 'Arrêt complet jusqu\'à revue de tous les trades du drawdown'],
              ['Trades hors fenêtre de tir', '> 2 par semaine', "Je coupe les notifications en dehors des fenêtres"],
              ['Stop moyen', '> 15 pips', "Je n'entre plus : les zones sont mal identifiées"]
            ]},
          { type: 'list', title: 'Revue des 20 trades', items: [
            "Je ne juge un setup qu'après 20 trades et je compare ce chiffre aux autres setups du journal.",
            "Je vérifie l'espérance en R par setup, par session et par instrument.",
            "Je vérifie le respect des prises partielles (30 / 50 / solde) : c'est là que la performance se perd le plus souvent.",
            "Je conserve ce qui fonctionne. Je n'abandonne un setup que sur la base de 20 trades, jamais sur une impression."
          ]}
        ]
      }
    ],

    checklists: [
      {
        id: 'pre',
        title: 'Checklist pré-trade (avant chaque entrée)',
        hint: 'Aucune case non cochée = aucune entrée.',
        items: [
          "Biais de structure écrit en HTF (haussier, baissier ou consolidation)",
          "High/low du mois vérifié (créé entre le 26 et le 09) et cohérent avec le sens du trade",
          "Zone d'offre ou de demande identifiée et délimitée (bougie manipulatrice / qui prend l'argent)",
          "Liquidité cible repérée (intact, EQH/EQL, inducement)",
          "Prise de liquidité effectuée",
          "ChoCh confirmé en LTF",
          "BOS / intention dans le sens du biais",
          "Je suis dans une fenêtre de tir (Asie 1h–2h, Europe 8h–9h, USA 13h–14h)",
          "Moins de 2 stop loss pris aujourd'hui",
          "Stop à 15 pips maximum, placé avant l'entrée",
          "Ratio minimum 1:7 vérifié avant de cliquer",
          "Taille calculée par la formule (pas au feeling)",
          "Je peux citer le nom du setup (Golden, Complexe Pull Back, Market Shift, ODF)",
          "Rien ne m'oblige à prendre ce trade (ni ennui, ni revanche, ni peur de rater)"
        ]
      },
      {
        id: 'pendant',
        title: 'Checklist de gestion (position ouverte)',
        hint: 'Le trade est géré selon le plan, pas selon mon humeur.',
        items: [
          "Breakeven déplacé dès la cassure d'un high/low en ma faveur",
          "Target 1 : 30 % sécurisés",
          "Target 2 : 50 % sécurisés sur la liquidité suivante",
          "Target 3 : le solde court jusqu'à la prochaine zone HTF",
          "Je n'élargis jamais le stop, quelle que soit la situation",
          "Je ne prends pas un second trade avant d'être sorti du premier"
        ]
      },
      {
        id: 'post',
        title: 'Checklist post-trade (dans les 10 minutes)',
        hint: "Un trade non journalisé ne m'apprend rien.",
        items: [
          "Trade saisi dans le journal avec tous les champs obligatoires",
          "Setup, session et émotion renseignés",
          "Respect du plan noté honnêtement (oui / partiel / non)",
          "La liquidité visée et la liquidité réellement prise notées",
          "Erreur identifiée s'il y en a une, sans excuse",
          "Capture du graphique référencée (HTF et LTF)"
        ]
      },
      {
        id: 'hebdo',
        title: 'Checklist de revue hebdomadaire (dimanche)',
        hint: '30 minutes, toujours au même moment.',
        items: [
          "Tous les trades de la semaine sont journalisés",
          "Statistiques par setup calculées (espérance en R, ratio, réussite)",
          "Écarts au plan chiffrés et leur cause réelle écrite",
          "Biais mensuel et phases de Wyckoff en cours mis à jour",
          "Respect des prises partielles vérifié trade par trade",
          "Aucune modification du plan si un setup n'a pas atteint 20 trades",
          "Objectifs de la semaine prochaine écrits (processus, pas performance)"
        ]
      }
    ]
  };

  /* ---------------------------------------------------------
     État persistant des checklists
     --------------------------------------------------------- */
  var KEY = 'journal-trading:plan:v1';
  function loadChecks() {
    if (global.Lock && global.Lock.actif()) {
      var memoire = global.Lock.memoireDe('checks');
      if (memoire) { try { return JSON.parse(memoire) || {}; } catch (e) { return {}; } }
      return {};
    }
    try {
      var raw = global.localStorage && global.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveChecks(state) {
    var json = JSON.stringify(state);
    if (global.Lock && global.Lock.actif()) { global.Lock.ecrireCompartiment('checks', json); return; }
    try { global.localStorage && global.localStorage.setItem(KEY, json); } catch (e) { /* ignore */ }
  }

  /* ---------------------------------------------------------
     Contrôle de discipline : plan vs exécution réelle
     --------------------------------------------------------- */
  function statusOf(ok, warn) { return ok ? 'ok' : (warn ? 'warn' : 'ko'); }

  /**
   * @param {Object} model  modèle produit par Metrics.build
   * @returns {Array<{label, target, actual, status, hint}>}
   */
  function control(model) {
    var st = model.settings || {};
    var res = model.results || [];
    var cap = st.startingCapital || 0;
    var rows = [];
    if (!res.length) return rows;

    var closed = res.length;

    // 1. Risque par trade
    var maxRisk = Math.max.apply(null, res.map(function (t) { return t.riskAmount || 0; }));
    var riskPct = cap ? maxRisk / cap * 100 : 0;
    rows.push({
      label: 'Risque max par trade',
      target: '≤ ' + (st.riskPerTradePct || 1) + ' %',
      actual: riskPct.toFixed(2).replace('.', ',') + ' %',
      status: statusOf(riskPct <= (st.riskPerTradePct || 1) + 0.01, riskPct <= (st.riskPerTradePct || 1) * 1.25),
      hint: 'Risque le plus élevé observé sur la période.'
    });

    // 2. Trades par jour
    var maxPerDay = Math.max.apply(null, model.daily.map(function (d) { return d.count; }));
    rows.push({
      label: 'Trades max dans une journée',
      target: '≤ ' + (st.maxTradesPerDay || 3),
      actual: String(maxPerDay),
      status: statusOf(maxPerDay <= (st.maxTradesPerDay || 3), maxPerDay <= (st.maxTradesPerDay || 3) + 1),
      hint: 'Journée la plus active de la période.'
    });

    // 3. Perte max journalière
    var worstDay = model.records.worstDay;
    var worstDayPct = worstDay && cap ? Math.abs(Math.min(0, worstDay.net)) / cap * 100 : 0;
    rows.push({
      label: 'Perte max journalière',
      target: '≤ ' + (st.maxDailyLossPct || 3) + ' %',
      actual: worstDayPct.toFixed(2).replace('.', ',') + ' %' + (worstDay ? ' (' + worstDay.date.split('-').reverse().join('/') + ')' : ''),
      status: statusOf(worstDayPct <= (st.maxDailyLossPct || 3), worstDayPct <= (st.maxDailyLossPct || 3) * 1.2),
      hint: 'Pire journée en % du capital initial.'
    });

    // 4. Perte max hebdomadaire (pires 5 jours ouvrés glissants dans la semaine ISO)
    var worstWeek = model.weeks.slice().sort(function (a, b) { return a.net - b.net; })[0];
    var worstWeekPct = worstWeek && cap ? Math.abs(Math.min(0, worstWeek.net)) / cap * 100 : 0;
    rows.push({
      label: 'Perte max hebdomadaire',
      target: '≤ ' + (st.maxWeeklyLossPct || 6) + ' %',
      actual: worstWeekPct.toFixed(2).replace('.', ',') + ' %',
      status: statusOf(worstWeekPct <= (st.maxWeeklyLossPct || 6), worstWeekPct <= (st.maxWeeklyLossPct || 6) * 1.2),
      hint: 'Pire semaine de la période.'
    });

    // 5. Drawdown
    var ddPct = Math.abs(model.kpis.maxDDPct);
    rows.push({
      label: 'Drawdown maximum',
      target: '≤ ' + (st.maxDrawdownPct || 10) + ' %',
      actual: ddPct.toFixed(2).replace('.', ',') + ' %',
      status: statusOf(ddPct <= (st.maxDrawdownPct || 10), ddPct <= (st.maxDrawdownPct || 10) * 1.15),
      hint: 'Baisse maximale depuis un plus haut, sur la période filtrée.'
    });

    // 6. Respect du plan
    var pr = model.kpis.planRespectPct;
    rows.push({
      label: 'Trades conformes au plan',
      target: '≥ 90 %',
      actual: (pr === null ? '—' : pr.toFixed(0) + ' %'),
      status: pr === null ? 'warn' : statusOf(pr >= 90, pr >= 75),
      hint: 'Part de trades marqués « plan respecté ».'
    });

    // 7. Stop défini avant l'entrée
    var withStop = res.filter(function (t) { return t.stop !== null && t.entry !== null; }).length;
    var stopPct = withStop / closed * 100;
    rows.push({
      label: 'Trades avec stop enregistré',
      target: '100 %',
      actual: stopPct.toFixed(0) + ' %',
      status: statusOf(stopPct >= 99.5, stopPct >= 90),
      hint: 'Un trade sans stop dans le journal est un trade hors plan.'
    });

    // 8. Journal tenu (notes non vides)
    var noted = res.filter(function (t) { return (t.notes || '').trim().length > 3; }).length;
    var notePct = noted / closed * 100;
    rows.push({
      label: 'Trades documentés (notes)',
      target: '≥ 80 %',
      actual: notePct.toFixed(0) + ' %',
      status: statusOf(notePct >= 80, notePct >= 50),
      hint: 'Qualité de la mémoire écrite du journal.'
    });

    // 9. Revenge trading
    var revenge = res.filter(function (t) { return /revanche|revenge/i.test(t.mistake || ''); }).length;
    rows.push({
      label: 'Trades de revanche',
      target: '0',
      actual: String(revenge),
      status: statusOf(revenge === 0, revenge <= 2),
      hint: 'Trades marqués « Revenge trading » dans le journal.'
    });

    // 10. Espérance par trade
    var expR = model.kpis.expectancyR;
    rows.push({
      label: 'Espérance par trade',
      target: '> +0,20 R',
      actual: expR === null ? '—' : (expR > 0 ? '+' : '') + expR.toFixed(2).replace('.', ',') + ' R',
      status: expR === null ? 'warn' : statusOf(expR >= 0.2, expR >= 0),
      hint: 'Gain moyen attendu sur chaque trade pris.'
    });

    // 11. RR planifié (règle SMV : 1:7 minimum)
    var withRR = res.filter(function (t) { return t.plannedRR !== null && t.plannedRR !== undefined; });
    var okRR = withRR.filter(function (t) { return t.plannedRR >= 7; });
    var shareRR = withRR.length ? okRR.length / withRR.length * 100 : null;
    rows.push({
      label: 'Ratio planifié ≥ 1:7',
      target: '≥ 90 %',
      actual: shareRR === null ? '—' : shareRR.toFixed(0).replace('.', ',') + ' % (' + okRR.length + '/' + withRR.length + ')',
      status: shareRR === null ? 'warn' : statusOf(shareRR >= 90, shareRR >= 70),
      hint: withRR.length ? 'Part des trades dont le ratio risque/gain visé atteint au moins 1:7.' : 'Renseignez la cible (TP) pour suivre cette règle.'
    });

    // 12. Stop loss (règle SMV : 15 pips maximum, forex et or)
    var withStop = res.filter(function (t) {
      if (t.entry === null || t.stop === null || t.entry === t.stop) return false;
      var ps = Store.pipSize ? Store.pipSize(t.symbol) : 0.0001;
      return ps <= 0.1; // forex, or : les indices cotés en points ne sont pas concernés
    });
    var pipsStop = withStop.map(function (t) { return Math.abs(t.entry - t.stop) / (Store.pipSize(t.symbol) || 0.0001); });
    var maxStop = pipsStop.length ? Math.max.apply(null, pipsStop) : null;
    var avgStop = pipsStop.length ? pipsStop.reduce(function (a, v) { return a + v; }, 0) / pipsStop.length : null;
    rows.push({
      label: 'Stop ≤ 15 pips',
      target: '≤ 15',
      actual: maxStop === null ? '—' : maxStop.toFixed(1).replace('.', ',') + ' pips (moy. ' + avgStop.toFixed(1).replace('.', ',') + ')',
      status: maxStop === null ? 'warn' : statusOf(maxStop <= 15, maxStop <= 19),
      hint: maxStop === null ? 'Renseignez entrée et stop pour suivre cette règle.' : 'Jeu de la règle : un stop au-delà de 15 pips invalide l\'entrée.'
    });

    // 13. Ratio gain/perte
    var payoff = model.kpis.payoff;
    rows.push({
      label: 'Ratio gain / perte moyen',
      target: '≥ 1,5',
      actual: payoff === null ? '—' : payoff.toFixed(2).replace('.', ','),
      status: payoff === null ? 'warn' : statusOf(payoff >= 1.5, payoff >= 1.2),
      hint: 'Taille moyenne des gains comparée aux pertes.'
    });

    // 14. Objectif mensuel
    var g = model.goals.month;
    rows.push({
      label: 'Objectif du mois en cours',
      target: '+' + g.targetPct + ' %',
      actual: (g.pct > 0 ? '+' : '') + g.pct.toFixed(2).replace('.', ',') + ' %',
      status: g.pct >= g.targetPct ? 'ok' : (g.pct >= 0 ? 'warn' : 'ko'),
      hint: g.trades + ' trade' + (g.trades > 1 ? 's' : '') + ' clôturé' + (g.trades > 1 ? 's' : '') + ' ce mois-ci.'
    });

    // 15. Perte du jour consommée
    var dl = model.goals.todayLimits;
    rows.push({
      label: 'Seuil de perte journalière',
      target: '≤ ' + dl.lossLimitPct + ' %',
      actual: dl.lossUsed <= 0 ? 'non entamé' : (dl.gauge.ratio).toFixed(0) + ' % du seuil',
      status: dl.gauge.tone === 'ok' ? 'ok' : dl.gauge.tone === 'warn' ? 'warn' : 'ko',
      hint: dl.lossReached ? 'Seuil atteint : arrêt imposé.' : 'Il reste ' + dl.lossLeft.toFixed(0) + ' € avant l\'arrêt de la journée.'
    });

    return rows;
  }

  /** Score global de discipline (0–100) à partir des lignes de contrôle. */
  function disciplineScore(rows) {
    if (!rows || !rows.length) return null;
    var pts = rows.reduce(function (a, r) { return a + (r.status === 'ok' ? 1 : r.status === 'warn' ? 0.5 : 0); }, 0);
    return Math.round(pts / rows.length * 100);
  }

  global.Plan = {
    data: PLAN,
    loadChecks: loadChecks,
    saveChecks: saveChecks,
    control: control,
    disciplineScore: disciplineScore,
    KEY: KEY
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.Plan;
})(typeof window !== 'undefined' ? window : globalThis);
