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
    version: '1.0',
    title: 'Plan de trading',
    subtitle: 'Forex & indices CFD — intraday et swing court',
    updated: 'Septembre 2026',
    mission: "Exécuter 3 setups connus, avec un risque fixe et une exécution notée, pour produire un rendement régulier et mesurable — pas pour avoir raison.",

    blocks: [
      /* ---------- 1 ---------- */
      {
        id: 'cadre',
        num: '01',
        title: 'Identité de trading',
        lead: 'Qui je suis en tant que trader, et dans quel cadre je travaille.',
        items: [
          { type: 'kv', rows: [
            ['Marché', 'Forex majeurs + or (XAUUSD) + indices (US30, NAS100)'],
            ['Style', 'Intraday sur session Londres / New York, swing 1 à 3 jours en complément'],
            ['Unité de temps', 'H4 = direction, H1 = structure, M15/M5 = déclencheur'],
            ['Horaires', '08h00–17h00 (heure de Bamako) du lundi au vendredi'],
            ['Instrument type', '1 à 3 paires suivies par semaine, pas plus'],
            ['Unité de risque', 'R : 1R = risque fixe par trade (voir section 03)']
          ]},
          { type: 'callout', tone: 'gold', title: 'Mon edge en une phrase',
            text: "Je prends le sens du biais H4 et je n'entre que sur un retest net d'une zone déjà cassée, en session liquide, avec un stop structurel — ma rentabilité vient du ratio moyen (≥ 1,5R) et non du taux de réussite." },
          { type: 'note', text: "Tout trade qui ne peut pas être décrit avec les 6 lignes ci-dessus, et rattaché à un setup de la section 04, n'est pas pris. Point." }
        ]
      },

      /* ---------- 2 ---------- */
      {
        id: 'objectifs',
        num: '02',
        title: 'Objectifs & jalons',
        lead: 'Trois niveaux d\'objectifs : le processus (ce que je contrôle), la performance (ce qui en découle), la compétence.',
        items: [
          { type: 'cards', cards: [
            { icon: '🎯', title: 'Objectif processus', value: '≥ 90 %', sub: 'de trades notés « plan respecté » chaque mois' },
            { icon: '📈', title: 'Objectif performance', value: '+5 % / mois', sub: 'soit ≥ 2R par semaine en moyenne, drawdown < 10 %' },
            { icon: '🧠', title: 'Objectif compétence', value: '50 trades revus', sub: 'chaque trimestre, avec statistiques par setup' }
          ]},
          { type: 'table',
            head: ['Période', 'Objectif de performance', 'Objectif de processus', 'Critère de réussite'],
            rows: [
              ['Mois 1', '0 % (ne pas perdre)', '10 à 15 trades notés', 'Le journal est rempli à 100 % et les règles de risque jamais violées'],
              ['Mois 2–3', '+2 à +4 % / mois', '≥ 90 % de trades conformes', 'Espérance en R positive sur ≥ 20 trades'],
              ['Mois 4–6', '+4 à +5 % / mois', '10 trades max / semaine', 'Profit factor > 1,3 et drawdown max < 8 %'],
              ['Mois 7–12', '+5 à +8 % / mois', '1 revue mensuelle documentée', 'Capital doublé en taille de risque autorisé (jamais + de 1 % / trade)']
            ]},
          { type: 'list', title: 'Conditions d\'arrêt (kill switch) — non négociables', items: [
            'Perte de 6 % du capital sur la semaine : je m\'arrête jusqu\'au lundi suivant, aucune exception.',
            'Perte de 10 % depuis le plus haut : retour en taille réduite (50 %) pendant 10 trades gagnants consécutifs de processus.',
            '3 trades consécutifs hors plan : arrêt 48 h + revue écrite avant de reprendre.',
            'Fatigue, maladie, conflit personnel majeur : pas de trading ce jour-là.'
          ]}
        ]
      },

      /* ---------- 3 ---------- */
      {
        id: 'risque',
        num: '03',
        title: 'Règles de risque',
        lead: 'Le risque est la seule variable 100 % sous mon contrôle : elle est fixe, chiffrée et vérifiée avant chaque clic.',
        items: [
          { type: 'kv', rows: [
            ['Capital de référence', '100 % (recalculé au 1er de chaque mois)'],
            ['Risque par trade', '1 % maximum, 0,5 % si 3 pertes d\'affilée dans la journée'],
            ['Risque total simultané', '2 % maximum (positions corrélées = une seule position)'],
            ['Perte max journalière', '2 % → arrêt immédiat de la journée'],
            ['Perte max hebdomadaire', '6 % → arrêt jusqu\'au lundi'],
            ['Drawdown max accepté', '10 % du plus haut → taille divisée par 2'],
            ['Trades max par jour', '3 (2 si la première est une perte)'],
            ['Stop obligatoire', 'Posé avant l\'entrée, jamais élargi, jamais « mental »']
          ]},
          { type: 'formula', title: 'Taille de position',
            lines: [
              'Risque en devise (R) = Capital × 1 %',
              'Distance au stop (en pips) = |Entrée − Stop| ÷ valeur du pip',
              'Taille (lots) = Risque en devise ÷ (Distance en pips × valeur du pip par lot)',
              'Exemple : capital 10 000 € → R = 100 €. Stop à 20 pips, pip à 10 €/lot → 100 ÷ (20 × 10) = 0,50 lot.'
            ]},
          { type: 'callout', tone: 'red', title: 'Les 4 interdits absolus',
            text: "1) Aucun trade sans stop. 2) Jamais de moyenne à la baisse (pas de « j'ajoute pour me refaire »). 3) Jamais élargir un stop. 4) Jamais doubler la taille pour récupérer une perte." }
        ]
      },

      /* ---------- 4 ---------- */
      {
        id: 'setups',
        num: '04',
        title: 'Les 3 setups autorisés',
        lead: 'Trois configurations, pas une de plus. Chacune est documentée : conditions, déclencheur, invalidation.',
        items: [
          { type: 'setup', name: 'A — Break & Retest',
            tag: 'Tendance / continuation',
            rows: [
              ['Contexte', 'Biais H4 clair (prix au-dessus/en dessous d\'une zone majeure) et structure H1 dans le même sens.'],
              ['Déclencheur', 'Cassure d\'une zone, puis retour du prix sur cette zone avec rejet (mèche + clôture M15 dans le sens).'],
              ['Entrée', 'À la clôture de la bougie de rejet ou au 50 % du corps de la bougie de cassure.'],
              ['Stop', 'Au-delà de la zone de retest (+ buffer de 1 à 2 pips / 2 à 3 points indices).'],
              ['Objectifs', 'TP1 = 1R (je sécurise 50 %), TP2 = plus haut/bas de swing suivant, trailing sur la structure H1.'],
              ['Invalidation', 'Clôture M15 de l\'autre côté de la zone, ou plus de 8 bougies M15 sans continuation.']
            ]},
          { type: 'setup', name: 'B — Pullback EMA en tendance',
            tag: 'Tendance / continuation',
            rows: [
              ['Contexte', 'Prix à plus de 30 pips (ou 40 points) de l\'EMA 20 en H1, EMA 20 au-dessus de l\'EMA 50, session active.'],
              ['Déclencheur', 'Retour sur l\'EMA 20 ou la zone 38–50 % de Fibonacci, avec bougie de reprise M5/M15.'],
              ['Entrée', 'Au franchissement du haut/bas de la bougie de reprise (ordre stop limite).'],
              ['Stop', 'Sous le dernier creux/sommet mineur, 1,2 × ATR(14) M15 maximum.'],
              ['Objectifs', 'TP1 = plus haut précédent, TP2 = extension 1,618 de Fibonacci.'],
              ['Invalidation', 'Deux clôtures M15 sous l\'EMA 50 : le setup n\'existe plus, j\'annule l\'ordre.']
            ]},
          { type: 'setup', name: 'C — Range asiatique (session Londres)',
            tag: 'Cassure de range / volatilité',
            rows: [
              ['Contexte', 'Range asiatique de 30 à 70 pips maximum, pas de news majeure à 08h30–09h00 (heure de Bamako).'],
              ['Déclencheur', 'Ouverture de Londres + cassure franche du range (corps de bougie M15, pas une mèche).'],
              ['Entrée', 'Sur la cassure, ou sur le premier retest de la borne du range.'],
              ['Stop', 'À l\'intérieur du range, à mi-hauteur au maximum.'],
              ['Objectifs', 'TP = hauteur du range projetée depuis la cassure. TP1 à 1R.'],
              ['Invalidation', 'Retour dans le range pendant plus de 3 bougies M15 → sortie au break-even.']
            ]},
          { type: 'note', text: 'Chaque setup doit atteindre 20 trades avant d\'être jugé. Avant ce seuil : aucune conclusion, aucune modification du plan — on exécute et on mesure.' }
        ]
      },

      /* ---------- 5 ---------- */
      {
        id: 'routine',
        num: '05',
        title: 'Routine quotidienne',
        lead: 'Le plan ne s\'exécute pas à l\'écran mais avant et après. Quatre moments, toujours les mêmes.',
        items: [
          { type: 'routine', title: 'Avant la séance (07h30 – 08h00)', icon: '🌅', items: [
            'Calendrier économique : news rouges des prochaines 8 h notées (éviter 15 min avant/après).',
            'Biais H4 et H1 écrits en une phrase par instrument suivi.',
            'Zones de liquidité et niveaux clés tracés sur les graphiques.',
            'Risque du jour calculé : R = ______ € / FCFA ; taille à utiliser : ______ lots.',
            'Objectif du jour : 1 à 2 trades de qualité, pas « gagner ».'
          ]},
          { type: 'routine', title: 'Pendant la séance', icon: '🎯', items: [
            'Zone de trading silencieuse : téléphone en mode avion, réseaux sociaux fermés.',
            'J\'attends que le prix vienne à ma zone : aucune entrée « au feeling ».',
            'Ordre posé avec stop + TP : j\'arrête de regarder le trade une fois entré.',
            'Après 2 pertes ou 3 trades : écran fermé pour la journée.'
          ]},
          { type: 'routine', title: 'Après la séance (17h00 – 17h30)', icon: '🌇', items: [
            'Chaque trade est saisi dans le journal : chiffres, capture d\'écran, émotion, erreur éventuelle.',
            'Répétition mentale : ce qui a bien fonctionné, ce qui doit changer demain.',
            'Aucun trade n\'existe s\'il n\'est pas dans le journal le soir même.'
          ]},
          { type: 'routine', title: 'Revue hebdomadaire (dimanche, 30 min)', icon: '📅', items: [
            'Statistiques de la semaine : résultat en R, nombre de trades, respect du plan (%), erreurs récurrentes.',
            'Classement des setups : lequel gagne, lequel coûte — je note, je n\'abandonne rien avant 20 trades.',
            'Une action concrète unique à corriger pour la semaine suivante.',
            'Vérification des limites : perte max journalière / hebdo / drawdown respectées ?'
          ]}
        ]
      },

      /* ---------- 6 ---------- */
      {
        id: 'journal',
        num: '06',
        title: 'Tenue du journal',
        lead: 'Un trade non journalisé est un trade perdu deux fois : on perd l\'argent et l\'information.',
        items: [
          { type: 'table',
            head: ['Champ', 'Ce qu\'on y met', 'Pourquoi'],
            rows: [
              ['Résultat (R)', 'Multiple du risque : +1,5R, −1R…', 'Comparer les trades entre eux, indépendamment de la taille'],
              ['Setup', 'A, B ou C uniquement', 'Savoir quel setup est réellement rentable'],
              ['Respect du plan', 'Oui / Partiel / Non', 'Séparer la performance de l\'exécution'],
              ['Émotion', 'Calme, FOMO, revanche…', 'Repérer les états qui coûtent de l\'argent'],
              ['Erreur', 'Une seule par trade', 'Corriger une chose à la fois'],
              ['Capture d\'écran', 'Avant et après le trade', 'Relire la situation réelle, pas le souvenir'],
              ['Notes', '2 lignes maximum', 'Garder une trace lisible lors des revues']
            ]},
          { type: 'callout', tone: 'green', title: 'Règle des 3 chiffres',
            text: 'Chaque soir je dois pouvoir répondre sans chercher : combien de R aujourd\'hui, combien de trades, combien de trades hors plan. Le tableau de bord de l\'application doit être lu au minimum 2 minutes par jour.' }
        ]
      },

      /* ---------- 7 ---------- */
      {
        id: 'discipline',
        num: '07',
        title: 'Discipline & récupération',
        lead: 'Les pertes sont normales ; les dérapages ne le sont pas. Voici le protocole exact.',
        items: [
          { type: 'steps', steps: [
            { title: 'Perte journalière atteinte (2 %)', text: 'Je ferme tout, je note la cause dans le journal, je ne touche plus à la plateforme jusqu\'au lendemain. 30 minutes de relecture du plan.' },
            { title: '2 pertes consécutives', text: 'Taille divisée par 2 pour le trade suivant. Le troisième trade doit être une configuration parfaite, sinon il n\'a pas lieu d\'être.' },
            { title: '3 trades hors plan', text: 'Arrêt 48 h. Je relis les 3 trades, j\'écris ce qui a déclenché la sortie du cadre (fatigue ? déception ? ennui ?) et j\'ajoute un garde-fou concret.' },
            { title: 'Semaine négative', text: 'Revue écrite de 45 min : les pertes venaient-elles du setup, de l\'exécution ou du marché ? Aucune modification du plan avant 20 trades sur un setup.' },
            { title: 'Série gagnante', text: 'Je ne change rien. Taille identique. Les séries gagnantes sont l\'endroit où l\'on abandonne sa discipline le plus rapidement.' }
          ]},
          { type: 'list', title: 'Signaux d\'alerte personnels (si 2 sont réunis : journée off)', items: [
            'Je regarde le graphique pour me rassurer plutôt que pour exécuter un plan.',
            'Je réduis mes distances de stop « pour augmenter la taille ».',
            'Je prends un trade moins de 5 minutes après une perte.',
            'Je reste devant l\'écran après l\'objectif atteint ("encore un").',
            'Je n\'ai pas ouvert le journal depuis 2 jours.'
          ]}
        ]
      },

      /* ---------- 8 ---------- */
      {
        id: 'suivi',
        num: '08',
        title: 'Suivi de performance (KPI et seuils)',
        lead: 'Ce que je regarde, à quelle fréquence, et la décision associée à chaque seuil.',
        items: [
          { type: 'table',
            head: ['Indicateur', 'Cible', 'Seuil d\'alerte', 'Décision si seuil franchi'],
            rows: [
              ['Espérance par trade (R)', '> +0,20 R', '< 0 R sur 20 trades', 'Réduire la taille de moitié et revoir les setups'],
              ['Taux de réussite', '≥ 45 %', '< 35 %', 'Vérifier la qualité des entrées (trop tôt / trop tard)'],
              ['Ratio gain / perte moyen', '≥ 1,5', '< 1,2', 'Ne plus couper les gains avec un TP partiel trop près'],
              ['Profit factor', '> 1,3', '< 1,0', 'Stop de la stratégie en démo pendant 2 semaines'],
              ['Respect du plan', '≥ 90 %', '< 75 %', 'Une seule action corrective pour la semaine (pas cinq)'],
              ['Drawdown max', '< 10 %', '> 10 %', 'Taille divisée par 2 jusqu\'à retour au plus haut'],
              ['Trades par jour', '≤ 3', '> 3 deux jours de suite', 'Blocage du compte jusqu\'au lundi'],
              ['Temps en position', '< 4 h (intraday)', '> 8 h', 'Sortie à midi ou passage en swing assumé, pas subi']
            ]},
          { type: 'callout', tone: 'violet', title: 'Lecture du dashboard',
            text: 'Le dashboard de l\'application affiche ces indicateurs en direct. Une revue = lire les KPI, comparer au plan, écrire UNE décision. Une décision qui change trop souvent n\'est pas une décision.'
          }
        ]
      }
    ],

    /* ---------------------------------------------------------
       Checklists interactives (cochées/décochées, sauvegardées)
       --------------------------------------------------------- */
    checklists: [
      {
        id: 'pre',
        title: 'Checklist pré-trade (avant chaque entrée)',
        hint: 'Aucune case non cochée = aucune entrée.',
        items: [
          'Biais H4/H1 écrit et cohérent avec le sens du trade',
          'Le setup correspond exactement à la fiche A, B ou C',
          'Zone tracée à l\'avance, pas improvisée',
          'Stop placé à un endroit structurel (pas un chiffre rond)',
          'Distance du stop ≤ 1,2 × ATR(14)',
          'Taille calculée à partir du risque fixe',
          'Ratio gain/risque potentiel ≥ 1,5',
          'Pas de news majeure dans les 15 minutes',
          'Session liquide (Londres / New York)',
          'Je suis calme : aucune envie de « me refaire »',
          'Le trade est inscrit dans le journal avant l\'entrée'
        ]
      },
      {
        id: 'post',
        title: 'Checklist post-trade (le soir)',
        hint: 'Un trade non journalisé le soir même est un trade perdu de vue.',
        items: [
          'Journal complété : entrée, sortie, taille, résultat en R',
          'Capture d\'écran avant + après enregistrée',
          'Respect du plan coché honnêtement (oui / partiel / non)',
          'Émotion dominante notée',
          'Une seule erreur identifiée (s\'il y en a une)',
          'Résultat en R comparé à ce que le plan prévoyait',
          'Note en 2 lignes : ce que je referais / ce que je ne referai plus'
        ]
      },
      {
        id: 'hebdo',
        title: 'Checklist revue hebdomadaire (dimanche)',
        hint: '30 minutes, à heure fixe, dashboard ouvert.',
        items: [
          'Résultat de la semaine en R et en % du compte',
          'Nombre de trades et respect du plan (%)',
          'Classement des setups gagnants / perdants de la semaine',
          'Erreurs répétées : est-ce la même que la semaine dernière ?',
          'Limites de risque respectées : journalière, hebdomadaire, drawdown',
          'Une action corrective unique écrite pour la semaine suivante',
          'Prochaines news majeures et jours fériés notés',
          'Prochain niveau de taille de risque confirmé (inchangé sauf règle atteinte)'
        ]
      }
    ]
  };

  /* ---------------------------------------------------------
     État persistant des checklists
     --------------------------------------------------------- */
  var KEY = 'journal-trading:plan:v1';
  function loadChecks() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }
  function saveChecks(state) {
    try { global.localStorage && global.localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
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

    // 11. Ratio gain/perte
    var payoff = model.kpis.payoff;
    rows.push({
      label: 'Ratio gain / perte moyen',
      target: '≥ 1,5',
      actual: payoff === null ? '—' : payoff.toFixed(2).replace('.', ','),
      status: payoff === null ? 'warn' : statusOf(payoff >= 1.5, payoff >= 1.2),
      hint: 'Taille moyenne des gains comparée aux pertes.'
    });

    // 12. Objectif mensuel
    var g = model.goals.month;
    rows.push({
      label: 'Objectif du mois en cours',
      target: '+' + g.targetPct + ' %',
      actual: (g.pct > 0 ? '+' : '') + g.pct.toFixed(2).replace('.', ',') + ' %',
      status: g.pct >= g.targetPct ? 'ok' : (g.pct >= 0 ? 'warn' : 'ko'),
      hint: g.trades + ' trade(s) clôturé(s) ce mois-ci.'
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
