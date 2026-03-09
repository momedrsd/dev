# Compétition Coran Édition 9 — React Frontend

## Structure
```
src/
├── App.jsx                    # Router principal
├── main.jsx                   # Point d'entrée
├── index.css                  # Styles (copie v26)
├── context/
│   └── AppContext.jsx         # État global + Socket.IO + API
├── hooks/
│   └── useTimer.js            # Hook chronomètre
└── components/
    ├── LoginPage.jsx          # Page de connexion
    ├── Dashboard.jsx          # Shell admin/président/juge
    ├── PublicScreen.jsx       # Écran public/participant
    ├── Mushaf.jsx             # Visionneuse double page
    ├── ScoringPanel.jsx       # Panneau de notation
    ├── ToastContainer.jsx     # Notifications
    ├── LoadingScreen.jsx      # Écran de chargement
    └── pages/
        ├── DashboardPage.jsx  # Tableau de bord
        ├── ParticipantsPage.jsx
        ├── RankingsPage.jsx
        ├── FinalePage.jsx
        ├── CompSettingsPage.jsx
        ├── UsersPage.jsx
        ├── CriteriaPage.jsx   # + TimerSettings + Emergency
        ├── TimerSettingsPage.jsx
        └── EmergencyPage.jsx
```

## Pour intégrer dans Lovable
1. Importer ce projet dans Lovable (GitHub ou zip)
2. Le backend `server.js` reste séparé sur Node.js port 3000
3. Vite proxy redirige `/api` et `/socket.io` vers `localhost:3000`

## Lancer en dev
```bash
# Terminal 1 - Backend
cd ../quran-competition && npm start

# Terminal 2 - Frontend React
npm install && npm run dev
```

## Comptes
- admin / password
- president / password  
- juge1..4 / password
- public / password
- participant / password
