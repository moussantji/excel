/* =========================================================
   formation-contenu.js — Le cours SMV, chapitre par chapitre

   Contenu fidèle aux deux documents fournis :
   - « Ultra Book FX » — Tout comprendre de la stratégie Smart
     Money Vision (introduction + modules 1 à 8)
   - « Plan trading » — le plan écrit (4 lois, Wyckoff,
     liquidité) et le plan de trading de l'application

   L'ordre suivi est celui des 12 chapitres du plan, comme
   demandé : chaque chapitre indique sa source.

   Aucun emoji, aucun caractère décoratif : uniquement du texte,
   pour rester lisible à l'impression et sur toutes les tablettes.
   ========================================================= */
(function (global) {
  'use strict';

  var CHAPITRES = [
    /* =====================================================
       01
       ===================================================== */
    {
      id: 'identite',
      num: '01',
      titre: 'Identité de trading',
      source: 'Ultra Book FX — introduction · plan, chapitre 01',
      essentiel: 'La SMV (Smart Money Vision) est une stratégie de suivi des big boyz : on ne devine pas, on attend les confirmations optimales en HTF puis en LTF avant de prendre position. Quatre lois la structurent : la structure, l\'offre et la demande, la cause à effet, la liquidité.',
      lecons: [
        {
          titre: 'Ce que dit la méthode',
          texte: 'Les mouvements du marché sont le fait des big boyz (banques, fonds, institutions). Notre travail n\'est pas de prévoir leur intention, mais de la lire : quand la structure casse, quand une zone est défendue, quand la liquidité est prise. On se place après eux, jamais avant.',
          points: [
            'Sans structure lisible, on ne prend pas de trade : la structure est notre indicateur directionnel.',
            'On attend la confirmation en HTF (biais, zones) puis en LTF (prise de liquidité, ChoCh, BOS, entrée).',
            'Le rendement vient du ratio, pas du taux de réussite : 1:7 minimum.'
          ]
        },
        {
          titre: 'Les règles de la méthode',
          texte: 'Elles sont peu nombreuses et ne se négocient pas. Ce sont elles qui rendent la méthode survivable sur cent trades, pas les trois premiers.',
          points: [
            'Risque : 1 % maximum par trade, fourchette de travail 0,25 % à 1 %.',
            'Stop loss : 15 pips maximum, jamais élargi.',
            'Ratio risque/rendement : 1:7 minimum.',
            'Deux stop loss pris dans la journée : la journée est terminée.'
          ]
        },
        {
          titre: 'La séquence de lecture',
          texte: 'C\'est l\'enchaînement du document « Plan trading ». On le suit toujours dans le même ordre, du haut vers le bas.',
          points: [
            'HTF d\'abord : prise d\'inducement (LH I / HL I), premium ou discount, zone d\'offre, zone de demande.',
            'LTF ensuite : prise de liquidité, ChoCh (changement de caractère), BOS ou intention, consolidation.',
            'Puis l\'exécution : golden setup ou concept entry, avec le BOS comme confirmation finale.',
            'Entrée ratée : on ne court pas après le prix, on attend le retour dans la zone (ODF).'
          ]
        }
      ],
      graphique: 'Sur le graphique, cette étape ne se voit pas encore : c\'est le cadre dans lequel toute lecture va se faire. Avant d\'ouvrir le moindre trade, vous devez pouvoir nommer le biais du mois, les zones majeures et la fenêtre de tir dans laquelle vous travaillez.',
      etapes: [
        'Ouvrir le HTF (D1 puis H4) et se demander : haussier, baissier ou en consolidation ?',
        'Marquer les zones d\'offre et de demande majeures, rien d\'autre.',
        'Descendre en LTF uniquement pendant une fenêtre de tir.',
        'Attendre la prise de liquidité, puis le ChoCh : sans les deux, aucune position.',
        'Écrire le trade en une phrase rattachée à une des 4 lois, sinon ne pas le prendre.'
      ],
      erreurs: [
        'Chercher un trade au lieu d\'attendre qu\'il se présente.',
        'Passer en LTF avant d\'avoir écrit le biais HTF.',
        'Traiter les règles de risque comme des recommandations.',
        'Changer de méthode après trois pertes : aucune évaluation avant 20 trades.'
      ],
      entraineur: 'tendance',
      exercices: [
        {
          q: 'Quel est le risque maximum par trade dans la SMV ?',
          choix: ['0,25 %', '1 %', '2 %', '5 %'],
          bonne: 1,
          explication: 'La règle est 1 % maximum par trade. La fourchette de travail va de 0,25 % à 1 % : on peut risquer moins, jamais plus.'
        },
        {
          q: 'Quel ratio risque/rendement minimum le plan impose-t-il ?',
          choix: ['1:1', '1:3', '1:7', '1:15'],
          bonne: 2,
          explication: '1:7 minimum : c\'est ce ratio qui permet d\'être rentable avec un taux de réussite faible. Le rendement vient du ratio, pas du pourcentage de trades gagnants.'
        },
        {
          q: 'Quelle est la longueur maximale du stop loss ?',
          choix: ['5 pips', '15 pips', '30 pips', 'Cela dépend de la volatilité'],
          bonne: 1,
          explication: '15 pips maximum, et il n\'est jamais élargi. Si la configuration demande plus, la zone est mal identifiée : on ne prend pas le trade.'
        },
        {
          q: 'Dans quel ordre lit-on le marché ?',
          choix: [
            'LTF d\'abord pour trouver l\'entrée, puis HTF pour valider',
            'HTF d\'abord pour le biais et les zones, puis LTF pour la prise de liquidité et le ChoCh',
            'Peu importe, seule compte la figure chartiste',
            'On lit uniquement le LTF pendant les fenêtres de tir'
          ],
          bonne: 1,
          explication: 'HTF puis LTF : le HTF donne la direction et les zones majeures, le LTF donne le déclencheur (prise de liquidité, ChoCh, BOS).'
        },
        {
          q: 'Après deux stop loss pris dans la journée, que faites-vous ?',
          choix: ['Je réduis la taille et je continue', 'Je change d\'instrument', 'J\'arrête la journée', 'Je double la taille pour me refaire'],
          bonne: 2,
          explication: 'Deux stop loss : la journée est terminée, sans exception. C\'est le kill switch du plan, et c\'est ce qui protège le compte.'
        }
      ]
    },

    /* =====================================================
       02
       ===================================================== */
    {
      id: 'objectifs',
      num: '02',
      titre: 'Objectifs et jalons',
      source: 'plan, chapitre 02',
      essentiel: 'Le processus d\'abord, la performance ensuite. On mesure d\'abord ce que l\'on contrôle (trades notés, respect du plan, revue écrite), parce que la performance est la conséquence de ces gestes, pas leur cause.',
      lecons: [
        {
          titre: 'Les deux objectifs',
          texte: 'Chaque mois porte deux objectifs : un objectif de processus (au moins 90 % de trades notés « plan respecté ») et un objectif de performance (+5 % par mois, avec un ratio moyen de 1:7 minimum et un drawdown sous 10 %). Si le premier est tenu et pas le second, on continue : le processus paie plus tard. L\'inverse est un signal d\'alarme.',
          points: [
            'Mois 1 : ne pas perdre, remplir le journal à 100 %.',
            'Mois 2 à 3 : +2 à +4 % par mois, espérance en R positive sur au moins 20 trades.',
            'Mois 4 à 6 : +4 à +5 % par mois, profit factor supérieur à 1,3.',
            'Mois 7 à 12 : +5 % par mois, ratio moyen de 1:7 tenu sur 100 trades.'
          ]
        },
        {
          titre: 'Les conditions d\'arrêt (kill switch)',
          texte: 'Elles sont écrites à l\'avance, pour ne pas être négociées sous pression. Décider à froid ce qui arrête une journée ou une semaine est la seule façon de tenir.',
          points: [
            '2 stop loss dans la journée : journée terminée.',
            '6 % de perte sur la semaine : arrêt jusqu\'au lundi.',
            '10 % de perte depuis le plus haut : taille réduite de moitié pendant 10 trades conformes.',
            '3 trades consécutifs hors plan : arrêt 48 h et revue écrite.',
            'Fatigue, maladie, conflit personnel majeur : pas de trading.'
          ]
        }
      ],
      graphique: 'Aucun graphique ici : ce chapitre se vérifie dans le journal. Le test est simple — si vous ne pouvez pas dire combien de trades conformes vous avez faits ce mois-ci, l\'objectif de processus n\'est pas suivi.',
      etapes: [
        'Écrire ses jalons du mois avant de commencer à trader.',
        'Compter les trades conformes, pas seulement les euros gagnés.',
        'Vérifier chaque semaine les conditions d\'arrêt : sont-elles proches ?',
        'Ne juger la performance qu\'après 20 trades sur un setup donné.'
      ],
      erreurs: [
        'Se juger sur une semaine, ou sur un trade.',
        'Improviser l\'arrêt au lieu de l\'avoir écrit.',
        'Reprendre le trading après une perte pour « se refaire ».',
        'Modifier le plan avant d\'avoir 20 trades dans le journal.'
      ],
      entraineur: null,
      exercices: [
        {
          q: 'Que fait-on si l\'objectif de processus est tenu mais pas l\'objectif de performance ?',
          choix: [
            'On change de méthode',
            'On continue : le processus finit par payer',
            'On augmente le risque par trade',
            'On réduit le nombre de trades'
          ],
          bonne: 1,
          explication: 'Le processus d\'abord. Un plan correctement exécuté sur 20 trades donne l\'information nécessaire ; changer avant, c\'est ne rien apprendre.'
        },
        {
          q: 'À partir de quand juge-t-on un setup ?',
          choix: ['Après 3 trades', 'Après 10 trades', 'Après 20 trades', 'Après le premier trade gagnant'],
          bonne: 2,
          explication: '20 trades : c\'est la règle du plan. Avant ce seuil, aucune conclusion, aucune modification.'
        },
        {
          q: 'Quel pourcentage de perte hebdomadaire déclenche l\'arrêt jusqu\'au lundi ?',
          choix: ['3 %', '6 %', '10 %', '20 %'],
          bonne: 1,
          explication: '6 % de perte sur la semaine : arrêt jusqu\'au lundi suivant. Le seuil de 10 % concerne la perte depuis le plus haut, qui impose de réduire la taille de moitié.'
        },
        {
          q: 'Le mois 1, quel est l\'objectif de performance ?',
          choix: ['+5 %', '+10 %', 'Ne pas perdre', 'Doubler le capital'],
          bonne: 2,
          explication: 'Mois 1 : ne pas perdre, et remplir le journal à 100 %. L\'objectif est d\'installer le geste, pas de gagner vite.'
        }
      ]
    },

    /* =====================================================
       03
       ===================================================== */
    {
      id: 'risque',
      num: '03',
      titre: 'Règles de risque et money management',
      source: 'Ultra Book FX — introduction (règles) · plan, chapitre 03',
      essentiel: 'Le risque est la seule variable que vous contrôlez à 100 %. Taille de position, place du stop, mise à breakeven et prises partielles sont calculées avant l\'entrée, jamais pendant.',
      lecons: [
        {
          titre: 'Les chiffres qui ne bougent pas',
          texte: 'Risque 1 % maximum par trade (fourchette 0,25 % – 1 %), stop 15 pips maximum, ratio 1:7 minimum, deux stop loss par jour et pas trois. Ces quatre chiffres sont votre marge de survie.',
          points: [
            'Une perte de 1 % demande environ +1,01 % pour revenir ; une perte de 20 % demande +25 % : c\'est là que meurent les comptes.',
            'Le stop ne s\'élargit jamais : on préfère annuler le trade.',
            'La taille sort d\'une formule, jamais d\'une impression.'
          ]
        },
        {
          titre: 'La formule de taille de position',
          texte: 'Elle se calcule en trois lignes. C\'est le seul calcul de la méthode que vous devez savoir faire de tête, à l\'envers comme à l\'endroit.',
          points: [
            'Risque en devise (R) = capital × 1 %',
            'Distance au stop (pips) = |entrée − stop| ÷ valeur du pip',
            'Taille (lots) = R ÷ (distance au stop × valeur du pip par lot)',
            'Exemple : capital 10 000 € → R = 100 €. Stop à 12 pips, pip à 10 €/lot → 100 ÷ 120 = 0,83 lot.'
          ]
        },
        {
          titre: 'La gestion en cours de trade',
          texte: 'Trois paliers, décidés avant l\'entrée. Breakeven dès que le BOS confirme dans votre sens ; 30 % sécurisés au premier palier ; 50 % sur le premier intact ; le solde laissé courir jusqu\'à la prochaine zone HTF. C\'est le dernier palier qui produit la performance.',
          points: [
            'Breakeven : dès la cassure d\'un high/low (BOS) en votre faveur.',
            'Target 1 (30 %) : à 1:2 minimum, pour payer le trade.',
            'Target 2 (50 %) : sur le premier intact buyer/seller.',
            'Target 3 (solde) : laissé courir vers la zone HTF suivante.'
          ]
        },
        {
          titre: 'Les 4 interdits absolus',
          texte: 'Élargir un stop. Prendre un troisième trade après deux stop loss. Entrer sans ChoCh ni prise de liquidité. Trader en dehors des fenêtres de tir. Aucune de ces erreurs n\'a de circonstance atténuante.',
          points: []
        }
      ],
      graphique: 'Le risque se lit sur le graphique avant tout calcul : où se place l\'invalidation logique (derrière le point A ou B du complexe, sous le plus bas du SPRING, au-delà du niveau balayé) ? Si cette distance dépasse 15 pips, le trade est trop cher : on ne le prend pas.',
      etapes: [
        'Identifier l\'invalidation logique de la configuration (pas un chiffre arbitraire).',
        'Mesurer la distance en pips entre l\'entrée et cette invalidation.',
        'Si elle dépasse 15 pips : abandonner le trade.',
        'Calculer R (capital × 1 %) puis la taille en lots.',
        'Placer le stop avant l\'entrée, jamais après.',
        'Décider à l\'avance les trois paliers de sortie.'
      ],
      erreurs: [
        'Calculer la taille au feeling ou par habitude.',
        'Déplacer le stop quand le prix s\'en approche.',
        'Prendre le troisième trade après deux stop loss.',
        'Laisser un trade gagnant redevenir perdant faute de breakeven.'
      ],
      entraineur: null,
      exercices: [
        {
          q: 'Capital 10 000 €, risque 1 %, stop à 10 pips, pip à 10 € par lot. Quelle taille ?',
          choix: ['0,5 lot', '1 lot', '1,5 lot', '2 lots'],
          bonne: 1,
          explication: 'R = 10 000 × 1 % = 100 €. Distance × pip par lot = 10 × 10 = 100 €. Taille = 100 ÷ 100 = 1 lot.'
        },
        {
          q: 'Quelle est la fourchette de risque autorisée par trade ?',
          choix: ['0,25 % à 1 %', '0,5 % à 2 %', '1 % à 3 %', 'Libre selon la conviction'],
          bonne: 0,
          explication: 'De 0,25 % à 1 %. La conviction n\'entre pas dans le calcul du risque : c\'est justement quand on est sûr de soi qu\'il faut risquer le moins.'
        },
        {
          q: 'Quand met-on la position à breakeven ?',
          choix: [
            'Après 20 pips de gain',
            'Dès que le BOS confirme dans notre sens',
            'Jamais : on laisse le stop initial',
            'Quand on a peur'
          ],
          bonne: 1,
          explication: 'Dès la cassure d\'un high/low (BOS) en notre faveur. Le plan est explicite : on ne laisse plus une position gagnante redevenir perdante.'
        },
        {
          q: 'Quel palier fait la performance selon le plan ?',
          choix: ['Target 1 (30 %)', 'Target 2 (50 %)', 'Target 3, le solde laissé courir', 'Les trois à égalité'],
          bonne: 2,
          explication: 'Le dernier palier : c\'est lui qui va chercher la zone HTF et permet les ratios de 1:7 et plus. Les paliers 1 et 2 servent à sécuriser et à réduire la pression.'
        },
        {
          q: 'La distance d\'invalidation mesurée est de 22 pips. Que faites-vous ?',
          choix: [
            'Je prends le trade avec un stop de 22 pips',
            'J\'abandonne le trade',
            'Je réduis le stop à 15 pips pour que ça passe',
            'J\'augmente la taille pour compenser'
          ],
          bonne: 1,
          explication: 'Stop 15 pips maximum, sans exception. Un stop artificiellement rapproché se fait balayer ; la place du stop est logique, pas ajustable.'
        }
      ]
    },

    /* =====================================================
       04
       ===================================================== */
    {
      id: 'setups',
      num: '04',
      titre: 'Les setups autorisés',
      source: 'plan, chapitre 04 · Ultra Book FX, modules 7 et 8',
      essentiel: 'Quatre configurations, pas une de plus. Chaque trade du journal doit pouvoir être rattaché à l\'une d\'elles, avec son contexte, son déclencheur, son entrée, son stop, ses objectifs et son invalidation.',
      lecons: [
        {
          titre: 'A — Golden Setup (phase C de Wyckoff)',
          texte: 'Contexte : une consolidation s\'est installée (accumulation ou distribution), avec ses phases A et B identifiables en HTF, et le biais mensuel est connu. Déclencheur : en phase C, le SPRING (accumulation) ou l\'UTAD (distribution) vient chercher la liquidité laissée par le STB ou le UT. Entrée : au retest de la zone après la secousse, quand le ChoCh confirme le changement de caractère en LTF. Stop : 15 pips maximum, sous le plus bas du SPRING (ou au-dessus du plus haut de l\'UTAD). Objectifs : la liquidité interne, puis les intacts buyer/seller des phases A et B.',
          points: [
            'On prend position dans la phase C, pas dans la secousse elle-même.',
            'Invalidation : retour dans la fourchette sans ChoCh, ou nouveau bas (SPRING avorté).'
          ]
        },
        {
          titre: 'B — Complexe Pull Back',
          texte: 'Contexte : tendance de structure claire (HH/HL en haussier, LH/LL en baissier) et complexe pull back identifiable par ses points A et B. Déclencheur : le prix revient dans le complexe après une prise de liquidité sur un inducement (LH I / HL I). Entrée : au ChoCh en LTF à l\'intérieur du complexe, dans le sens de la structure dominante. Stop : 15 pips maximum, derrière le point A ou B. Objectifs : l\'intact suivant, puis l\'extension de la tendance.',
          points: [
            'Le complexe pull back est délimité par l\'offre et la demande.',
            'Invalidation : BOS contraire au complexe, ou cassure franche du point B.'
          ]
        },
        {
          titre: 'C — Market Shift (prise de liquidité + ChoCh)',
          texte: 'Contexte : structure en fin de mouvement (perte de puissance des impulsions) et signature de liquidité visible (mèche marquée). Déclencheur : prise de liquidité sur un high/low majeur (intact, EQH/EQL ou trendline de liquidité), puis ChoCh qui invalide la structure précédente. Entrée : jamais sur la réaction directe — on attend la confirmation, puis on entre au retest de la zone laissée par la prise de liquidité. Stop : 15 pips maximum, au-delà du niveau balayé.',
          points: [
            'C\'est le setup des retournements, celui qui se rapproche le plus du piège à contre-sens.',
            'Invalidation : pas de ChoCh après la prise de liquidité, ou retour au-delà du niveau balayé.'
          ]
        },
        {
          titre: 'D — ODF (entrée ratée)',
          texte: 'Contexte : le setup était valide, le prix est parti sans vous. Déclencheur : retour du prix sur la zone d\'origine après le mouvement manqué. Entrée : au retest de la zone, avec confirmation LTF — jamais en poursuite. Objectifs : les mêmes que le setup initial, avec un premier palier plus court. Invalidation : prix qui ne revient pas dans la zone, on oublie le trade.',
          points: [
            'Poursuivre le prix est ce qui transforme une bonne lecture en mauvaise exécution.',
            'Les modules « Concept Entry » et « Raffinage PE/SL » annoncés au sommaire de l\'Ultra Book FX ne figurent pas dans le document fourni : ce chapitre reste à compléter quand ils seront disponibles.'
          ]
        }
      ],
      graphique: 'Chaque setup a une signature visuelle : le SPRING laisse une mèche sous la fourchette, le complexe pull back a deux points d\'arrêt (A et B), le market shift prend un high majeur puis casse la structure en sens inverse, l\'ODF revient simplement sur la zone déjà travaillée.',
      etapes: [
        'Nommer le contexte (tendance ou consolidation) avant toute chose.',
        'Repérer le déclencheur (SPRING, UTAD, prise de liquidité, inducement).',
        'Attendre la confirmation en LTF : ChoCh puis BOS.',
        'Entrer au retest de la zone, jamais sur la réaction directe.',
        'Placer le stop à l\'invalidation logique, 15 pips maximum.',
        'Écrire l\'invalidation avant d\'entrer : c\'est elle qui décide de sortir.'
      ],
      erreurs: [
        'Entrer sans pouvoir nommer le setup.',
        'Confondre golden setup et simple cassure de fourchette.',
        'Poursuivre le prix après une entrée ratée.',
        'Prendre un trade hors des quatre setups parce qu\'il « ressemble » à quelque chose.'
      ],
      entraineur: 'wyckoff',
      exercices: [
        {
          q: 'À quel moment précis prend-on position dans le golden setup ?',
          choix: [
            'Pendant la secousse (SPRING ou UTAD)',
            'Au retest de la zone, après confirmation LTF',
            'Après la sortie complète de la fourchette',
            'À l\'ouverture de la séance'
          ],
          bonne: 1,
          explication: 'On prend position au retest de la zone laissée par la secousse, quand le ChoCh confirme. Entrer dans la secousse, c\'est risquer de se faire balayer par le mouvement lui-même.'
        },
        {
          q: 'Que délimite le complexe pull back ?',
          choix: ['Deux moyennes mobiles', 'Les points A et B qui arrêtent le mouvement', 'Le high et le low du mois', 'La trendline de liquidité'],
          bonne: 1,
          explication: 'Le complexe pull back est composé d\'un point A et d\'un point B, tous les deux arrêtant un mouvement, et il est délimité par l\'offre et la demande.'
        },
        {
          q: 'Le prix est parti sans vous sur un golden setup. Que faites-vous ?',
          choix: [
            'J\'entre au marché pour ne pas rater la suite',
            'J\'attends le retour du prix dans la zone (ODF)',
            'Je passe à un autre instrument',
            'Je double la taille sur le prochain signal'
          ],
          bonne: 1,
          explication: 'Entrée ratée : on attend le retour dans la zone (setup D, ODF), avec confirmation. Jamais de poursuite.'
        },
        {
          q: 'Quelle invalidation correspond au golden setup d\'accumulation ?',
          choix: [
            'Un nouveau bas sous le SPRING ou un retour dans la fourchette sans ChoCh',
            'Trois bougies rouges consécutives',
            'Le prix touche le milieu de la fourchette',
            'Aucune : le setup ne s\'invalide pas'
          ],
          bonne: 0,
          explication: 'SPRING avorté ou retour dans la fourchette sans ChoCh : le setup n\'existe plus, on annule. Une invalidation doit toujours être écrite avant l\'entrée.'
        }
      ]
    },

    /* =====================================================
       05
       ===================================================== */
    {
      id: 'structure',
      num: '05',
      titre: 'Loi 1 — La structure is queen',
      source: 'Ultra Book FX, module 1 · plan, chapitre 05',
      essentiel: 'La structure est votre indicateur directionnel : elle dit si le marché est haussier (HH/HL), baissier (LH/LL) ou en consolidation. Elle vous dit aussi sur quel mouvement vous surfez : les 80 % (continuation) ou les 20 % (retracement).',
      lecons: [
        {
          titre: 'Lire une tendance en deux phrases',
          texte: 'Haussière : les hauts sont de plus en plus hauts (Higher High, HH) et les bas de plus en plus hauts (Higher Low, HL). Baissière : les hauts sont de plus en plus bas (Lower High, LH) et les bas de plus en plus bas (Lower Low, LL). Consolidation : les hauts et les bas restent dans une fourchette ; la direction n\'a pas encore été donnée. Il faudra attendre les prises de liquidité et les BOS pour connaître le biais.',
          points: [
            'Objectif premier en tendance haussière : acheter sur les plus bas (HL), donc faire partie des 80 %.',
            'Objectif premier en tendance baissière : vendre sur les plus hauts (LH).',
            'On peut trader les 20 % (retracement), mais en sachant que le mouvement ne durera pas.'
          ]
        },
        {
          titre: 'Les trois cassures de structure (BOS)',
          texte: 'Le BOS (Break of Structure) est une cassure de la structure qui a un sens. Il y en a trois, et les confondre coûte cher.',
          points: [
            'BOS classique (changement de tendance) : la cassure montre l\'arrêt de la tendance en cours et l\'intention inverse.',
            'BOS de continuation : la cassure confirme que la tendance actuelle se poursuit — on suit les 80 %.',
            'BOS piège (trap) : cassure laissée par les big boyz qui ne tient pas. Elle attrape ceux qui ne lisent pas la structure de gauche à droite et ne regardent pas la structure majeure.'
          ]
        },
        {
          titre: 'Structure majeure, structure mineure, fractalité',
          texte: 'Pour valider une nouvelle structure majeure, il faut créer un haut au-dessus du haut précédent ou un bas sous le bas précédent. La structure mineure est celle qui se forme à l\'intérieur. La fractalité fait le reste : la même lecture s\'applique en D1 et en H1 — ce qui est un retracement de 20 % en D1 est une tendance complète en H1.',
          points: [
            'Toujours privilégier la structure dominante : garder le focus sur les 80 %.',
            'Hedging concept : pouvoir être positionné sur l\'impulsion (80 %) et sur le retracement (20 %) en même temps, en toute conscience.',
            'Structure de rotation : un retracement structuré peut continuer la tendance, ou marquer sa fin — la zone de neutralité aide à les distinguer.'
          ]
        }
      ],
      graphique: 'Ce que vous devez voir : deux hauts et deux bas récents. S\'ils montent tous les deux, le biais est haussier. Puis le dernier high (ou low) cassé par une clôture : regardez si le prix continue (continuation), s\'il revient (piège) ou s\'il part dans l\'autre sens (changement).',
      etapes: [
        'Passer en HTF et marquer les deux derniers hauts et les deux derniers bas.',
        'Conclure : haussière, baissière ou consolidation.',
        'Descendre d\'un cran et refaire la même lecture (fractalité).',
        'Repérer la dernière cassure de structure et la classer : continuation, changement ou piège.',
        'Vérifier la tenue : une cassure qui ne tient pas n\'est pas une cassure.',
        'Écrire une phrase : « structure haussière, dernière cassure de continuation, j\'achète les replis tant que le dernier HL tient ».'
      ],
      erreurs: [
        'Marquer trop de sommets : deux hauts et deux bas suffisent.',
        'Lire de droite à gauche (on regarde ce qui vient de se passer et on cherche une raison).',
        'Prendre une cassure majeure pour un simple bruit, faute d\'avoir regardé le HTF.',
        'Trader un retracement en croyant suivre la tendance.'
      ],
      entraineur: 'tendance',
      exercices: [
        {
          q: 'Une tendance haussière se reconnaît à :',
          choix: ['Des hauts et des bas de plus en plus hauts', 'Des hauts plus bas et des bas plus bas', 'Une série de bougies vertes', 'Un prix qui monte depuis une heure'],
          bonne: 0,
          explication: 'Haussière = HH (hauts plus hauts) et HL (bas plus hauts). La couleur des bougies n\'est pas une structure.'
        },
        {
          q: 'Une cassure de structure qui n\'a pas tenu est :',
          choix: ['Un BOS de continuation', 'Un BOS piège', 'Une consolidation', 'Une invalidité sans importance'],
          bonne: 1,
          explication: 'C\'est le BOS trap : les big boyz ont laissé la cassure pour piéger ceux qui ne lisent pas de gauche à droite ni la structure majeure.'
        },
        {
          q: 'Que valide une nouvelle structure majeure ?',
          choix: [
            'Trois bougies dans le même sens',
            'Un haut au-dessus du haut précédent ou un bas sous le bas précédent',
            'Un croisement de moyennes',
            'Une clôture hebdomadaire positive'
          ],
          bonne: 1,
          explication: 'La validation est structurelle : un nouveau high au-dessus du précédent, ou un nouveau low en dessous.'
        },
        {
          q: 'Qu\'appelle-t-on les 80 % ?',
          choix: [
            'Les trades gagnants',
            'Le mouvement de continuation (l\'impulsion), par opposition aux 20 % de retracement',
            'La part de réussite attendue',
            'Les 80 % du capital engagés'
          ],
          bonne: 1,
          explication: 'Les 80 % désignent le mouvement de fond (impulsion, continuation), les 20 % la correction. On privilégie toujours la structure dominante.'
        },
        {
          q: 'En structure baissière, où veut-on vendre ?',
          choix: ['Sur les plus bas (LL)', 'Sur les plus hauts (LH)', 'Au milieu de la fourchette', 'Peu importe, la tendance porte'],
          bonne: 1,
          explication: 'On vend les hauts (LH) : c\'est là que se placent les vendeurs institutionnels et que le risque est le plus court.'
        }
      ]
    },

    /* =====================================================
       06
       ===================================================== */
    {
      id: 'offre-demande',
      num: '06',
      titre: 'Lois 2 et 3 — Offre/demande et cause à effet',
      source: 'Ultra Book FX, modules 2, 3 et 4 · plan, chapitres 06',
      essentiel: 'L\'offre et la demande sont les zones où les big boyz se sont placés : on vend sur les offres, on achète sur les demandes. La cause à effet explique le reste : les mouvements ne sont pas aléatoires, ils viennent après une période de préparation.',
      lecons: [
        {
          titre: 'Délimiter une zone',
          texte: 'L\'offre est délimitée sur un high par une bougie manipulatrice et/ou une bougie qui prend l\'argent ; la demande est délimitée sur un low par les mêmes bougies. Les signatures algorithmiques sont les traces laissées par les big boyz sous forme de bougies : elles montrent où les institutions sont placées.',
          points: [
            'Zone d\'offre : zone potentielle de vente, on y vend.',
            'Zone de demande : zone potentielle d\'achat, on y achète.',
            'Une doji signature marque souvent la fin d\'un mouvement ; une signature de liquidité (longue mèche) indique la liquidité à aller chercher.'
          ]
        },
        {
          titre: 'Order flow et breaker bloc',
          texte: 'L\'order flow, ce sont des mitigations sur mitigations de l\'offre ou de la demande : la nouvelle bougie manipulatrice vient récupérer la précédente. Le breaker bloc utilise la polarité inverse : une offre qui devient demande, ou une demande qui devient offre — le même niveau change de camp.',
          points: [
            'Mitigation : la zone est retestée et « payée » avant de produire son effet.',
            'Polarité inverse : après une cassure, une ancienne offre peut servir de demande (et inversement).'
          ]
        },
        {
          titre: 'Le cycle du marché : consolidation et tendance',
          texte: 'Le marché est fait de hauts et de bas (la structure), mais aussi de consolidations et de tendances qui alternent. Deux types de consolidation : l\'accumulation, processus d\'achat des big boyz qui a pour conséquence un mouvement acheteur ; la distribution, processus de vente qui a pour conséquence un mouvement vendeur. On retrouve aussi la réaccumulation et la redistribution.',
          points: [
            'Demande supérieure à l\'offre : le prix monte. Offre supérieure : le prix baisse. Demande égale à l\'offre : la cause se met en place (consolidation).',
            'La cause (préparation) précède l\'effet (tendance). C\'est la loi de cause à effet de Wyckoff.',
            'Dans la cause, on doit détecter le failed qui construit la liquidité et qui est un des premiers signes du changement de caractère.'
          ]
        },
        {
          titre: 'Les intacts : les cibles',
          texte: 'Un intact est un high ou un low non manipulé. Il y en a deux sortes : l\'intact buyer (un low que le prix n\'est pas encore venu chercher) et l\'intact seller (un high intact). Ils servent à fixer les targets. Deux issues possibles : soit l\'intact se fait BOS, soit il est nettoyé (il devient clean buyer ou clean seller) — et il perd alors son intérêt.',
          points: [
            'Target 1 et Target 2 se placent souvent sur les intacts de la structure.',
            'Un intact nettoyé ne sert plus de cible : il faut le retirer de la carte.'
          ]
        }
      ],
      graphique: 'Ce que vous devez voir : la bougie qui a manipulé (longue mèche, corps rejeté) et la bougie suivante qui prend l\'argent. C\'est ce couple qui dessine la zone à trader. Si le prix revient dessus, la zone a été « payée » ; s\'il repart sans la toucher, l\'intact reste une cible.',
      etapes: [
        'Repérer la dernière impulsion et remonter à son origine.',
        'Encadrer la bougie manipulatrice et la bougie qui prend l\'argent : c\'est la zone.',
        'Nommer la zone : offre (on vend) ou demande (on achète).',
        'Chercher la cause : y a-t-il eu accumulation ou distribution avant cette impulsion ?',
        'Vérifier si la zone a déjà été mitigée (testée) ou si elle est encore vierge.',
        'Fixer les cibles sur les intacts et retirer ceux déjà nettoyés.'
      ],
      erreurs: [
        'Encadrer une zone trop large : on ne sait plus où est l\'invalidation.',
        'Trader une zone déjà nettoyée en croyant qu\'elle est encore active.',
        'Ignorer la polarité inverse après une cassure.',
        'Confondre cause et effet : entrer pendant la consolidation au lieu d\'attendre son issue.'
      ],
      entraineur: 'zones',
      exercices: [
        {
          q: 'Comment délimite-t-on une zone d\'offre ?',
          choix: [
            'Par trois bougies haussières',
            'Par la bougie manipulatrice et/ou la bougie qui prend l\'argent, sur un high',
            'Par le high et le low de la veille',
            'Par la moyenne des 20 dernières bougies'
          ],
          bonne: 1,
          explication: 'La zone se délimite sur un high par la bougie manipulatrice et/ou la bougie qui prend l\'argent. Sur une offre, on vend.'
        },
        {
          q: 'Demande égale à offre signifie :',
          choix: ['Le prix monte', 'Le prix baisse', 'La cause se met en place (consolidation)', 'Le marché est fermé'],
          bonne: 2,
          explication: 'Demande = offre : le marché construit une cause, c\'est-à-dire une consolidation, qui donnera l\'effet ensuite.'
        },
        {
          q: 'Qu\'est-ce qu\'un breaker bloc ?',
          choix: [
            'Une zone qui disparaît après deux tests',
            'Une offre devenue demande, ou une demande devenue offre (polarité inverse)',
            'Un bloc de bougies rouges',
            'Une consolidation de trois semaines'
          ],
          bonne: 1,
          explication: 'Le breaker bloc repose sur la polarité inverse : le niveau change de camp après une cassure, et c\'est ce qui le rend intéressant.'
        },
        {
          q: 'Que devient un intact après avoir été nettoyé ?',
          choix: [
            'Il devient clean buyer ou clean seller et perd son intérêt comme cible',
            'Il double de puissance',
            'Il devient une zone d\'offre',
            'Il reste une cible prioritaire'
          ],
          bonne: 0,
          explication: 'Soit l\'intact se fait BOS, soit il est nettoyé : dans ce second cas il devient clean et ne sert plus de cible.'
        },
        {
          q: 'L\'accumulation est :',
          choix: [
            'Un processus de vente qui mène à la baisse',
            'Un processus d\'achat des big boyz qui mène à un mouvement acheteur',
            'Une période d\'annonces économiques',
            'Une erreur de lecture'
          ],
          bonne: 1,
          explication: 'Accumulation : les big boyz achètent pendant la consolidation, ce qui produit ensuite un mouvement acheteur. La distribution fait l\'inverse.'
        }
      ]
    },

    /* =====================================================
       07
       ===================================================== */
    {
      id: 'liquidite',
      num: '07',
      titre: 'Loi 4 — La liquidité',
      source: 'Ultra Book FX, modules 4, 5 et 6 · plan, chapitre 07',
      essentiel: 'Chaque high ou low non manipulé renferme de la liquidité : les stops s\'y accumulent. C\'est votre carte des cibles — et la raison pour laquelle le marché va souvent chercher un niveau avant de partir dans l\'autre sens.',
      lecons: [
        {
          titre: 'Intacts, EQH/EQL et trendlines de liquidité',
          texte: 'Un intact buyer ou seller est un low ou un high non encore manipulé : c\'est une réserve de liquidité et une cible naturelle. Quand plusieurs hauts ou plusieurs bas se trouvent au même niveau, on parle d\'EQH (Equal Highs) et d\'EQL (Equal Lows) : la ligne attire les stops. Quand ces niveaux se relient en biais, on parle de trendline de liquidité.',
          points: [
            'EQH/EQL : la liquidité est visible de tous, donc elle est visée.',
            'Trendline de liquidité : une série de hauts ou de bas alignés, qui accumule de la liquidité le long de la ligne.',
            'Une signature de liquidité (bougie à longue mèche derrière le corps) indique qu\'il y a beaucoup à prendre sur un niveau.'
          ]
        },
        {
          titre: 'Inducement : la liquidité qui n\'est pas évidente',
          texte: 'Le LH/HL inducement est un haut ou un bas qui ne donne que des continuations, ou qui ne casse pas la structure. Il sert d\'appât : vous croyez à une entrée évidente, mais le prix ne fait que continuer, et c\'est votre stop qui est visé.',
          points: [
            'Prise d\'inducement en HTF : elle fait partie des confirmations optimales du plan.',
            'Un inducement non pris doit rendre méfiant : la liquidité a une raison d\'être là.',
            'On ne place pas son stop juste derrière un inducement visible de tous.'
          ]
        },
        {
          titre: 'La hiérarchie des cibles',
          texte: 'Tous les niveaux ne se valent pas. On vise d\'abord la liquidité interne (celle de la fourchette en cours), puis les intacts de la structure, puis les niveaux majeurs (EQH/EQL majeurs, high/low du mois).',
          points: [
            'Liquidité interne d\'abord : c\'est elle qui déclenche souvent le mouvement.',
            'Intacts ensuite : ce sont les cibles des paliers 1 et 2.',
            'Niveaux majeurs en dernier : c\'est là que va le solde du dernier palier (c\'est lui qui fait la performance).'
          ]
        }
      ],
      graphique: 'Ce que vous devez voir : les hauts ou les bas qui se trouvent au même prix (EQH/EQL), la mèche longue qui trahit une prise de liquidité, et les niveaux encore intacts de chaque côté de la fourchette. Votre trade doit viser l\'un de ces niveaux, sinon il n\'a pas de cible logique.',
      etapes: [
        'Marquer sur la carte les hauts et les bas au même niveau (EQH/EQL).',
        'Identifier les intacts buyer/seller encore valides, de chaque côté du prix.',
        'Repérer les inducements : les hauts ou bas qui ne donneraient qu\'une continuation.',
        'Choisir la cible de chaque palier (interne, intact, niveau majeur).',
        'Se demander avant d\'entrer : où est la liquidité évidente, et qui va la prendre ?'
      ],
      erreurs: [
        'Mettre son stop juste derrière un niveau évident de tous.',
        'Viser une cible déjà nettoyée la veille.',
        'Oublier de vérifier les EQH/EQL avant de choisir la cible.',
        'Confondre une mèche de manipulation avec du simple bruit.'
      ],
      entraineur: 'liquidite',
      exercices: [
        {
          q: 'Que signale un EQH ?',
          choix: [
            'Deux hauts au même niveau, donc une ligne de liquidité à venir chasser',
            'Une divergence entre deux indicateurs',
            'La fin d\'une tendance baissière',
            'Un excès de volatilité'
          ],
          bonne: 0,
          explication: 'EQH = Equal Highs : deux hauts au même niveau créent une ligne de liquidité. Les stops des vendeurs s\'y accumulent, ce qui devient une cible.'
        },
        {
          q: 'Qu\'est-ce qu\'un inducement ?',
          choix: [
            'Un indicateur de tendance',
            'Un LH ou HL qui ne donne qu\'une continuation ou ne casse pas la structure',
            'Une annonce économique programmée',
            'Une zone d\'offre majeure'
          ],
          bonne: 1,
          explication: 'L\'inducement est un appât : un haut/bas qui semble annoncer une entrée mais ne fait que continuer le mouvement. On ne place pas son stop derrière.'
        },
        {
          q: 'Quelle est la bonne hiérarchie des cibles ?',
          choix: [
            'Les niveaux majeurs d\'abord, puis les intacts, puis la liquidité interne',
            'La liquidité interne, puis les intacts, puis les niveaux majeurs',
            'Dans n\'importe quel ordre, l\'essentiel est le ratio',
            'Uniquement le high ou low du mois'
          ],
          bonne: 1,
          explication: 'Interne d\'abord (elle déclenche souvent le mouvement), puis les intacts pour les paliers, puis les niveaux majeurs pour le dernier palier.'
        },
        {
          q: 'Une signature de liquidité, c\'est :',
          choix: [
            'Une bougie à longue mèche derrière son corps',
            'Trois bougies de même taille',
            'Un croisement de moyennes',
            'Un volume inhabituel'
          ],
          bonne: 0,
          explication: 'La bougie algorithmique à longue mèche montre qu\'il y a beaucoup de liquidité à aller chercher sur le niveau.'
        }
      ]
    },

    /* =====================================================
       08
       ===================================================== */
    {
      id: 'outils',
      num: '08',
      titre: 'Les outils de la SMV',
      source: 'Ultra Book FX, module 6 · plan, chapitre 08',
      essentiel: 'Les outils traduisent la lecture en décisions : le complexe pull back pour situer l\'entrée, la fibo SMC pour savoir si l\'on est dans la zone d\'achat ou de vente, le market shift pour lire un retournement, les sessions pour savoir quand travailler.',
      lecons: [
        {
          titre: 'Complexe pull back et fibo SMC',
          texte: 'Le complexe pull back est composé d\'un point A et d\'un point B, qui arrêtent tous les deux un mouvement ; il est délimité par l\'offre et la demande. La fibo SMC, elle, se lit sur trois niveaux simples : 100 %, 50 % et 0 %. Au-dessus du 50 %, on est en premium : on privilégie les ventes. En dessous, on est en discount : on privilégie les achats. Le 50 % est un niveau qui ne dure jamais.',
          points: [
            'Premium : on vend sur les hauts de la fourchette de Fibonacci.',
            'Discount : on achète sur les bas.',
            'Le milieu (50 %) ne se trade pas comme un niveau : il se traverse.'
          ]
        },
        {
          titre: 'Market shift : les quatre temps',
          texte: 'Le market shift est une réaction au-dessus ou en dessous d\'un high/low qui s\'est fait BOS. On ne trade pas la réaction directe, on attend les confirmations. La séquence, numérotée sur le graphique, décrit la manipulation d\'un retournement : 0 = tentative d\'arrêter le mouvement qui échoue ; 1 = le mouvement est arrêté et le failed est créé ; 2 = prise de la liquidité ; 3 = test de la prise de liquidité.',
          points: [
            'En version haussière (pour arrêter une baisse) : 0 échoue à arrêter la baisse, 1 crée le failed, 2 prend la liquidité, 3 la teste.',
            'En version baissière, la même séquence à l\'envers.',
            'C\'est le test (3) qui donne le prix d\'entrée optimal.'
          ]
        },
        {
          titre: 'Price delivery, IPA et imbalance',
          texte: 'Le price delivery (IPDA, Interbank Price Delivery Algorithm) rappelle que le marché est livré par un algorithme : le prix va chercher la liquidité par étapes. L\'IPA (inefficiency price action) est un déséquilibre : un manque d\'équilibre entre les ordres d\'achat et de vente, souvent visible comme un vide de prix que le marché vient combler.',
          points: [
            'Un déséquilibre non comblé attire le prix : c\'est une cible potentielle.',
            'Le price delivery explique pourquoi le marché va d\'une zone à l\'autre plutôt qu\'en ligne droite.'
          ]
        },
        {
          titre: 'Sessions, high/low du mois et vagues d\'Elliot',
          texte: 'Le document donne les sessions en heure de la France : Asie (2 h en hiver, 1 h en été), Europe (9 h en hiver, 8 h en été), États-Unis (14 h en hiver, 13 h en été). Votre plan les convertit en heure de Bamako : Asie 1h–2h, Europe 8h–9h, États-Unis 13h–14h — le Mali est à UTC+0 toute l\'année, ces heures ne bougent donc pas. Le high ou low du mois se forme entre le 26 et le 09 et donne le biais directionnel du mois ; il apparaît souvent après une secousse (nettoyage de liquidité ou annonce économique). Enfin, selon Elliot, on compte 4 à 5 vagues d\'impulsion, et l\'on observe la perte de puissance des impulsions.',
          points: [
            'Le high/low du mois est un repère de biais, pas un signal d\'entrée.',
            'La perte de puissance des impulsions annonce la fin du mouvement : c\'est là que le market shift devient intéressant.',
            'On ne travaille que dans les fenêtres de tir : Asie 1h–2h, Europe 8h–9h, USA 13h–14h (heure de Bamako).'
          ]
        }
      ],
      graphique: 'Ce que vous devez voir : la position du prix dans la fourchette (premium ou discount), les points A et B du complexe pull back, et la numérotation 0-1-2-3 d\'un market shift quand un high majeur vient d\'être pris.',
      etapes: [
        'Situer le prix : premium (au-dessus du 50 %) ou discount (en dessous) ?',
        'Délimiter le complexe pull back par ses points A et B.',
        'Vérifier la session : suis-je dans une fenêtre de tir ?',
        'Vérifier le biais du mois (high/low du mois formé entre le 26 et le 09).',
        'Compter les vagues : l\'impulsion perd-elle de la puissance ?',
        'Croiser avec la structure : deux outils qui se contredisent égalent pas de trade.'
      ],
      erreurs: [
        'Acheter en premium ou vendre en discount.',
        'Trader le 50 % comme s\'il s\'agissait d\'un niveau.',
        'Prendre le market shift sur la réaction directe, sans le test.',
        'Trader hors fenêtre de tir en croyant que « l\'occasion est trop belle ».'
      ],
      entraineur: 'zones',
      exercices: [
        {
          q: 'En premium, on privilégie :',
          choix: ['Les achats', 'Les ventes', 'L\'attente systématique', 'Les deux sans distinction'],
          bonne: 1,
          explication: 'Premium = au-dessus du 50 % de la fibo SMC : on privilégie les ventes. En discount, on privilégie les achats.'
        },
        {
          q: 'Le niveau 50 % de la fibo SMC est :',
          choix: ['Un support majeur', 'Une résistance majeure', 'Un niveau qui ne dure jamais', 'Le point d\'entrée idéal'],
          bonne: 2,
          explication: 'Le 50 % est un niveau de passage : il ne dure jamais. On ne bâtit pas une entrée dessus.'
        },
        {
          q: 'Dans un market shift haussier, que représente le temps 3 ?',
          choix: ['La tentative d\'arrêter la baisse qui échoue', 'La création du failed', 'La prise de liquidité', 'Le test de la prise de liquidité'],
          bonne: 3,
          explication: '0 : la tentative échoue. 1 : le mouvement est arrêté, le failed est créé. 2 : la liquidité est prise. 3 : la prise de liquidité est testée — c\'est là que se trouve le prix d\'entrée optimal.'
        },
        {
          q: 'Quelles sont les fenêtres de tir du plan, en heure de Bamako ?',
          choix: [
            'Asie 1h–2h, Europe 8h–9h, USA 13h–14h',
            'Asie 2h–3h, Europe 9h–10h, USA 14h–15h',
            'Europe uniquement, de 10h à 12h',
            'En continu pendant 24 heures'
          ],
          bonne: 0,
          explication: 'Le Mali est à UTC+0 : les heures du plan sont Asie 1h–2h, Europe 8h–9h, USA 13h–14h. Elles ne changent pas avec l\'heure d\'été française.'
        },
        {
          q: 'Le high ou low du mois se forme :',
          choix: ['Entre le 26 et le 09, souvent après une secousse', 'Le premier lundi du mois', 'À la clôture de Wall Street', 'Jamais avant le 15'],
          bonne: 0,
          explication: 'Il se crée entre le 26 et le 09 et indique le biais directionnel à prendre pour le mois. Cette secousse vient souvent d\'un nettoyage de liquidité ou d\'une annonce économique.'
        }
      ]
    },

    /* =====================================================
       09
       ===================================================== */
    {
      id: 'routine',
      num: '09',
      titre: 'Routine quotidienne',
      source: 'plan, chapitre 09',
      essentiel: 'Le plan ne s\'exécute pas à l\'écran mais avant et après. Quatre moments, toujours les mêmes : avant la séance, pendant, après, et la revue hebdomadaire du dimanche.',
      lecons: [
        {
          titre: 'Avant la séance (30 minutes avant la fenêtre)',
          texte: 'On prépare la carte avant que le marché ne bouge, pour ne pas improviser sous pression.',
          points: [
            'Vérifier le biais du mois (high/low formé entre le 26 et le 09) et le biais de la semaine.',
            'Marquer en HTF : zones d\'offre et de demande majeures, inducements, EQH/EQL, intacts buyer/seller.',
            'Noter les annonces économiques qui tombent dans la fenêtre de tir.',
            'Écrire le biais en une phrase, et les niveaux qui l\'invalideraient.'
          ]
        },
        {
          titre: 'Pendant la séance (fenêtres de tir uniquement)',
          texte: 'Des règles simples à tenir, parce qu\'elles ont été décidées avant.',
          points: [
            'Attendre la prise de liquidité, puis le ChoCh en LTF : sans les deux, rien.',
            'Un seul trade à la fois : attendre d\'être sorti avant d\'en chercher un autre.',
            'Stop à 15 pips maximum placé avant l\'entrée, jamais après.',
            'Breakeven dès la cassure d\'un high/low en notre faveur ; prises partielles 30 % / 50 % / solde.',
            'Deux stop loss pris : fermer la plateforme, même si une configuration parfaite apparaît.'
          ]
        },
        {
          titre: 'Après la séance (17h00 – 17h30)',
          texte: 'Le travail d\'après décide de la qualité du lendemain. Un trade dont on n\'a pas écrit la sortie, l\'émotion et l\'erreur ne laisse aucune trace exploitable : la même faute revient la semaine suivante. On remplit donc le journal avant de fermer la plateforme, et on prépare les niveaux du lendemain pendant que les niveaux sont encore frais.',
          points: [
            'Remplir le journal trade par trade : setup, session, émotion, erreur, capture.',
            'Noter chaque écart au plan et sa cause réelle, pas la cause confortable.',
            'Mettre à jour les niveaux pour le lendemain : liquidité restante, zones non testées.',
            'Vérifier le risque cumulé de la semaine avant de savoir si l\'on trade demain.'
          ]
        },
        {
          titre: 'Revue hebdomadaire (dimanche, 30 minutes)',
          texte: 'C\'est le moment de mesurer, pas de trader : on relit la semaine avec le journal sous les yeux, on compare l\'exécution au plan, et on écrit ce qui doit changer. Une revue sans conclusion écrite n\'est qu\'une relecture — et le plan ne se modifie qu\'après vingt trades sur un setup, jamais sur une impression de dimanche soir.',
          points: [
            'Relire les trades de la semaine et comparer exécution et plan.',
            'Mettre à jour le biais mensuel et repérer les phases de Wyckoff en cours sur les instruments suivis.',
            'Calculer les statistiques par setup : ratio moyen, taux de réussite, espérance.',
            'Aucune modification du plan tant qu\'un setup n\'a pas 20 trades dans le journal.'
          ]
        }
      ],
      graphique: 'La routine se vérifie sur une capture : avant la séance, votre graphique doit déjà porter les zones, les EQH/EQL et les intacts. Si vous les marquez en direct, vous êtes en retard sur le marché.',
      etapes: [
        'Bloquer les trois moments dans la journée (avant, pendant, après).',
        'Préparer la carte 30 minutes avant la fenêtre, toujours la même procédure.',
        'Pendant la séance : rien d\'autre que la checklist (liquidité, ChoCh, stop, tailles).',
        'Après la séance : journal complet, chaque trade, le jour même.',
        'Dimanche : revue écrite et statistiques par setup.'
      ],
      erreurs: [
        'Arriver devant l\'écran sans avoir écrit son biais.',
        'Chercher un second trade avant d\'être sorti du premier.',
        'Remplir le journal de mémoire le week-end.',
        'Sauter la revue du dimanche « parce que la semaine a été bonne ».'
      ],
      entraineur: null,
      exercices: [
        {
          q: 'Combien de temps avant la fenêtre de tir prépare-t-on la séance ?',
          choix: ['5 minutes', '15 minutes', '30 minutes', 'La veille au soir uniquement'],
          bonne: 2,
          explication: '30 minutes avant : c\'est le temps de vérifier le biais du mois et de la semaine, de marquer les zones et de noter les annonces.'
        },
        {
          q: 'Pendant la séance, combien de trades en parallèle ?',
          choix: ['Autant que possible', 'Un seul à la fois', 'Trois maximum', 'Deux si les setups sont différents'],
          bonne: 1,
          explication: 'Un seul trade à la fois : on attend d\'être sorti avant d\'en chercher un autre. Cela évite de multiplier le risque sans le voir.'
        },
        {
          q: 'Que fait-on après deux stop loss dans la journée ?',
          choix: [
            'On continue avec une taille réduite',
            'On ferme la plateforme, même si une configuration parfaite apparaît',
            'On change d\'instrument',
            'On attend une heure puis on reprend'
          ],
          bonne: 1,
          explication: 'On ferme. C\'est écrit dans la routine comme dans les règles de risque : c\'est la protection la plus efficace du compte.'
        },
        {
          q: 'Quand remplit-on le journal ?',
          choix: ['Le dimanche', 'Le lendemain matin', 'Immédiatement après la sortie du trade', 'Une fois par mois'],
          bonne: 2,
          explication: 'Immédiatement après la sortie : le souvenir d\'une émotion et d\'une erreur se perd en quelques heures. Un trade non journalisé n\'apprend rien.'
        }
      ]
    },

    /* =====================================================
       10
       ===================================================== */
    {
      id: 'journal',
      num: '10',
      titre: 'Tenue du journal',
      source: 'plan, chapitre 10',
      essentiel: 'Un trade non journalisé est un trade qui ne vous apprendra rien. Le journal n\'est pas une formalité administrative : c\'est l\'endroit où la méthode devient mesurable.',
      lecons: [
        {
          titre: 'Ce qui est obligatoire et ce qui explique',
          texte: 'Les champs obligatoires sont : date, instrument, session, setup, sens, entrée, stop, cible, taille, frais. Les champs de contexte — émotion, erreur, respect du plan (oui / partiel / non), note écrite — sont ceux qui expliquent le résultat. Sans note écrite, le trade est incomplet et à reprendre le soir même avant la revue.',
          points: [
            'Une capture du graphique en HTF et en LTF au moment de l\'entrée (lien ou référence).',
            'L\'écart au plan se chiffre en R, pas en euros : un écart vaut le même prix quelle que soit la taille.',
            'Respect du plan : oui, partiel ou non — c\'est cette colonne qui pilote la progression.'
          ]
        },
        {
          titre: 'Ce que l\'on note systématiquement',
          texte: 'Quatre notes qui font progresser plus vite que n\'importe quel indicateur.',
          points: [
            'La liquidité visée et celle qui a été prise : c\'est le cœur de la méthode.',
            'Le type de BOS rencontré (classique, continuation, piège) et si vous l\'avez correctement classé.',
            'Le setup utilisé : golden setup, complexe pull back, market shift ou ODF.',
            'L\'écart au plan en R, pas en euros.'
          ]
        }
      ],
      graphique: 'Le journal se relit avec le graphique ouvert : pour chaque trade, on remet le curseur à l\'entrée et on se demande si la lecture d\'aujourd\'hui est la même qu\'hier. C\'est l\'exercice le plus formateur de la méthode.',
      etapes: [
        'Remplir le journal juste après la sortie du trade.',
        'Vérifier que tous les champs obligatoires sont renseignés.',
        'Écrire la note de contexte, même courte, même désagréable.',
        'Rattacher le trade à un setup et à une des 4 lois.',
        'Noter la liquidité visée et celle réellement prise.',
        'Reprendre le même jour tout trade laissé incomplet.'
      ],
      erreurs: [
        'Journaliser à la fin de la semaine de mémoire.',
        'Ne noter que les trades gagnants.',
        'Écrire « erreur : aucune » sur tous les trades, y compris hors plan.',
        'Chiffrer l\'écart au plan en euros et comparer des trades de tailles différentes.'
      ],
      entraineur: null,
      exercices: [
        {
          q: 'Quel champ fait partie des obligatoires ?',
          choix: ['L\'humeur du jour', 'La taille de position', 'Le nombre de trades de la semaine', 'La météo du marché'],
          bonne: 1,
          explication: 'Date, instrument, session, setup, sens, entrée, stop, cible, taille, frais : la taille en fait partie, puisque c\'est elle qui fixe le risque réel.'
        },
        {
          q: 'Comment chiffre-t-on un écart au plan ?',
          choix: ['En euros', 'En R', 'En pourcentage du capital', 'En nombre de pips gagnés'],
          bonne: 1,
          explication: 'En R : un écart vaut le même prix quelle que soit la taille du trade. C\'est la seule unité comparable d\'un trade à l\'autre.'
        },
        {
          q: 'Un trade sans note écrite est :',
          choix: ['Acceptable si le trade est gagnant', 'Incomplet, à reprendre le soir même', 'Sans importance', 'À supprimer du journal'],
          bonne: 1,
          explication: 'Le plan est clair : pas de note écrite = trade incomplet, à reprendre le soir même avant la revue.'
        }
      ]
    },

    /* =====================================================
       11
       ===================================================== */
    {
      id: 'discipline',
      num: '11',
      titre: 'Discipline et récupération',
      source: 'plan, chapitre 11',
      essentiel: 'Ce qui vous protège, c\'est ce que vous avez décidé avant d\'être devant l\'écran. La discipline n\'est pas un trait de caractère : c\'est un ensemble de règles écrites et de signaux d\'alerte personnels.',
      lecons: [
        {
          titre: 'Les signaux d\'alerte personnels',
          texte: 'Si deux de ces signaux sont réunis dans la même journée, la journée est terminée. Ces signaux sont personnels : vous devez pouvoir les reconnaître chez vous, sans complaisance.',
          points: [
            'Je regarde les graphiques en dehors des fenêtres de tir.',
            'Je réduis mon stop mentalement pour « pouvoir entrer ».',
            'Je prends un trade parce que je viens d\'en rater un.',
            'Je cherche une raison d\'entrer plutôt qu\'une raison de ne pas entrer.',
            'Je n\'ai pas écrit mon biais avant l\'ouverture de la séance.'
          ]
        },
        {
          titre: 'La phrase d\'ancrage',
          texte: 'Elle se relit avant chaque séance, et surtout après une perte : « Je gagne avec un ratio, pas avec un taux de réussite. Attendre la confirmation n\'est pas perdre du temps, c\'est le métier. »',
          points: []
        },
        {
          titre: 'Récupérer après une série de pertes',
          texte: 'Après une série, la première chose à faire n\'est pas de reprendre le marché mais de relire ses propres trades : les erreurs se répètent de façon presque identique. Les conditions d\'arrêt du chapitre 02 s\'appliquent ici : arrêt 48 h après trois trades hors plan, taille réduite de moitié après 10 % de drawdown.',
          points: [
            'Relire les captures des trades perdants, dans l\'ordre, sans commenter.',
            'Chercher le point commun : heure, instrument, émotion, setup.',
            'Reprendre en taille réduite jusqu\'à 10 trades conformes.',
            'Ne jamais augmenter la taille pour « se refaire ».'
          ]
        }
      ],
      graphique: 'Le désastre n\'arrive presque jamais sur un graphique : il arrive entre deux trades, quand on cherche à se refaire. La discipline se lit dans le journal (l\'écart en R), pas sur le graphique.',
      etapes: [
        'Écrire ses propres signaux d\'alerte avant la prochaine séance.',
        'Les relire chaque matin avec la phrase d\'ancrage.',
        'Compter les signaux en fin de journée : deux signaux, journée off.',
        'Après une série de pertes, relire les captures avant de reprendre.',
        'Reprendre en taille réduite, jamais en taille augmentée.'
      ],
      erreurs: [
        'Croire que la discipline est une question de volonté.',
        'Reprendre le lendemain après trois trades hors plan, sans revue écrite.',
        'Augmenter la taille pour compenser une perte.',
        'Cacher les erreurs dans le journal.'
      ],
      entraineur: null,
      exercices: [
        {
          q: 'Combien de signaux d\'alerte justifient une journée off ?',
          choix: ['Un seul', 'Deux', 'Trois', 'Cinq'],
          bonne: 1,
          explication: 'Si deux signaux d\'alerte sont réunis dans la journée, la journée est terminée. C\'est écrit dans le plan.'
        },
        {
          q: 'Lequel de ces signaux est un signal d\'alerte du plan ?',
          choix: [
            'Noter son biais avant l\'ouverture',
            'Réduire son stop mentalement pour pouvoir entrer',
            'Attendre la prise de liquidité',
            'Faire sa revue hebdomadaire'
          ],
          bonne: 1,
          explication: 'Réduire le stop mentalement est un signe de pression : la configuration ne correspond plus aux règles, mais on veut entrer quand même.'
        },
        {
          q: 'Après trois trades consécutifs hors plan :',
          choix: ['Arrêt 48 h et revue écrite', 'On continue en réduisant la taille', 'On change de méthode', 'On double la taille pour compenser'],
          bonne: 0,
          explication: 'Trois trades hors plan : arrêt 48 heures et revue écrite avant de reprendre. La pause est une décision de gestion, pas un aveu de faiblesse.'
        },
        {
          q: 'Après une série de pertes, on reprend :',
          choix: ['En taille réduite jusqu\'à 10 trades conformes', 'En taille normale dès le lendemain', 'En doublant la taille', 'Sur un autre instrument sans relire ses trades'],
          bonne: 0,
          explication: 'Taille réduite de moitié jusqu\'à 10 trades conformes : on réinstalle le processus avant de rendre l\'échelle au risque.'
        }
      ]
    },

    /* =====================================================
       12
       ===================================================== */
    {
      id: 'kpi',
      num: '12',
      titre: 'Suivi de performance (KPI et seuils)',
      source: 'plan, chapitre 12',
      essentiel: 'Chaque indicateur a un seuil et une décision associée. Un chiffre qui n\'entraîne pas de décision ne sert à rien.',
      lecons: [
        {
          titre: 'Les indicateurs et leur décision',
          texte: 'Les seuils du plan, à connaître par cœur, parce qu\'ils déclenchent une action.',
          points: [
            'Respect du plan inférieur à 85 % : revue écrite obligatoire et taille réduite de moitié.',
            'Ratio gain/perte moyen inférieur à 1:3 : les entrées sont trop tardives — retravailler le placement (retest contre poursuite).',
            'Espérance par trade inférieure à 0 R sur 20 trades : arrêt du setup concerné et retour à l\'étude des phases de Wyckoff.',
            'Drawdown supérieur à 10 % : arrêt complet jusqu\'à revue de tous les trades du drawdown.',
            'Plus de 2 trades hors fenêtre de tir par semaine : couper les notifications hors fenêtres.',
            'Stop moyen supérieur à 15 pips : arrêter d\'entrer, les zones sont mal identifiées.'
          ]
        },
        {
          titre: 'La revue des 20 trades',
          texte: 'On ne juge un setup qu\'après 20 trades, et on le compare aux autres setups du journal. On vérifie l\'espérance en R par setup, par session et par instrument, ainsi que le respect des prises partielles (30 / 50 / solde) — c\'est là que la performance se perd le plus souvent. On garde ce qui fonctionne : un setup ne s\'abandonne que sur la base de 20 trades, jamais sur une impression.',
          points: [
            'Comparer les setups entre eux, pas seulement chacun dans son coin.',
            'Vérifier les sorties autant que les entrées.',
            'Écrire la conclusion de la revue et la date.',
            'Ne rien modifier avant la fin du cycle de 20 trades.'
          ]
        }
      ],
      graphique: 'Ces chiffres vivent dans les vues Analyses et Calendrier de l\'application. Le seul réflexe à prendre : ouvrir la revue hebdomadaire et vérifier qu\'aucun seuil n\'est franchi, dans l\'ordre du tableau ci-dessus.',
      etapes: [
        'Ouvrir la revue chaque dimanche, toujours la même.',
        'Vérifier les seuils un par un, dans l\'ordre.',
        'Écrire la décision quand un seuil est franchi.',
        'Comparer les setups entre eux à 20 trades.',
        'Contrôler les prises partielles : 30 %, 50 %, solde.'
      ],
      erreurs: [
        'Regarder le solde du compte au lieu des indicateurs.',
        'Abandonner un setup sur trois trades perdants.',
        'Ne pas vérifier les sorties (« je suis sorti trop tôt » ne se mesure pas à l\'œil).',
        'Franchir un seuil d\'alerte sans appliquer la décision associée.'
      ],
      entraineur: null,
      exercices: [
        {
          q: 'Le respect du plan tombe à 80 %. Que fait-on ?',
          choix: [
            'Rien, seul le résultat compte',
            'Revue écrite obligatoire et taille réduite de moitié',
            'On change de méthode',
            'On augmente le nombre de trades'
          ],
          bonne: 1,
          explication: 'Sous 85 % de respect du plan : revue écrite obligatoire et taille réduite de moitié. C\'est le processus qui doit être réparé en premier.'
        },
        {
          q: 'Un ratio gain/perte moyen sous 1:3 signifie :',
          choix: [
            'Les entrées sont trop tardives : il faut retravailler le placement',
            'Il faut augmenter la taille',
            'La méthode ne fonctionne pas',
            'Il faut arrêter de tenir le journal'
          ],
          bonne: 0,
          explication: 'Entrées trop tardives : on retravaille le placement (retest plutôt que poursuite du prix). On ne change pas la méthode, on corrige le geste.'
        },
        {
          q: 'Espérance négative sur 20 trades pour un setup :',
          choix: [
            'On le garde, c\'est la variance',
            'Arrêt du setup concerné et retour à l\'étude des phases de Wyckoff',
            'On le double pour se refaire',
            'On le remplace par un indicateur'
          ],
          bonne: 1,
          explication: 'Après 20 trades, une espérance en R négative est une information : on arrête ce setup et on retourne étudier la cause (phases de Wyckoff).'
        },
        {
          q: 'Quel seuil impose l\'arrêt complet ?',
          choix: ['Drawdown supérieur à 10 %', 'Deux trades perdants', 'Une semaine sans gain', 'Un stop touché'],
          bonne: 0,
          explication: 'Plus de 10 % de drawdown : arrêt complet jusqu\'à la revue de tous les trades de la période. C\'est la protection du capital.'
        }
      ]
    }
  ];

  global.FormationContenu = {
    chapitres: CHAPITRES,
    /* Sources mobilisées, citées pour rester vérifiable */
    sources: [
      'Ultra Book FX — Tout comprendre de la stratégie Smart Money Vision (introduction, modules 1 à 8)',
      'Plan trading — 4 lois, structure, offre et demande, cause à effet, liquidité (8 pages)',
      'Plan de trading de l\'application (12 chapitres)'
    ],
    manques: [
      'Modules 9 (Concept Entry), 10 (Raffinage PE/SL) et 11 (Étude de cas) : annoncés au sommaire de l\'Ultra Book FX mais absents du document fourni.',
      'Le terme « ODF » est repris tel quel du plan (« si entrée ratée — ODF ») ; il correspond au setup D (retour sur la zone après une entrée manquée).',
      'Les captures d\'écran du livre ne sont pas exploitables en texte : les exercices du chapitre correspondant sont donc dessinés par l\'entraîneur de l\'application.'
    ]
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.FormationContenu;
})(typeof window !== 'undefined' ? window : globalThis);
