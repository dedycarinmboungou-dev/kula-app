/* ─── Kula — Internationalization (FR / EN) ──────────────────────────────────── */

const I18N = {
  fr: {
    // Navigation
    nav_dashboard:    'Tableau de bord',
    nav_epargne:      'Épargne',
    nav_transactions: 'Historique',
    nav_chat:         'Coach IA',

    // Header
    greeting_morning:   'Bonjour',
    greeting_afternoon: 'Bon après-midi',
    greeting_evening:   'Bonsoir',
    slogan:             'Fais grandir ton argent',

    // Dashboard
    total_balance:    'Solde total',
    monthly_income:   'Revenus',
    monthly_expense:  'Dépenses',
    this_month:       'Ce mois',
    categories:       'Catégories',
    trend:            'Tendance',
    no_data:          'Aucune donnée ce mois',

    // Transactions
    add:              'Ajouter',
    cancel:           'Annuler',
    confirm:          'Confirmer',
    save:             'Enregistrer',
    delete_btn:       'Supprimer',
    income:           'Revenu',
    expense:          'Dépense',
    amount:           'Montant',
    category:         'Catégorie',
    description:      'Description',
    date:             'Date',
    receipt:          'Justificatif',
    no_transactions:  'Aucune transaction',

    // Épargne
    savings:          'Épargne',
    total_saved:      'Total épargné',
    objective:        'Objectif',
    pockets:          'poches',
    new_pocket:       'Nouvelle poche',
    pocket_name:      'Nom de la poche',
    target_amount:    'Objectif',
    target_date:      'Date cible',
    optional:         'optionnel',
    create_pocket:    'Créer la poche',
    add_funds:        'Ajouter',
    goal_reached:     'Objectif atteint !',
    remaining:        'Reste',

    // Budget
    budgets:          'Budgets mensuels',
    of_budget:        'du budget',

    // Chat / Coach
    coach_title:      'Coach Kula',
    coach_placeholder:'Décris ta dépense ou pose une question...',
    coach_welcome:    'Salut ! Je suis ton coach financier. Dis-moi ce que tu as dépensé ou demande-moi un conseil.',

    // Profile / Settings
    my_profile:       'Mon Profil',
    subscription:     'Mon abonnement',
    currency:         'Devise',
    language:         'Langue',
    feedback:         'Donner mon avis',
    feedback_placeholder: 'Votre message (optionnel)',
    feedback_send:    'Envoyer',
    feedback_thanks:  'Merci pour votre avis !',
    feedback_pick:    'Choisis une note (1 à 5 étoiles)',
    about:            'À propos',
    logout:           'Déconnexion',
    logout_confirm:   'Se déconnecter de Kula ?',
    member_since:     'Membre depuis',

    // Plan
    plan_premium:     'Plan Premium',
    plan_admin:       'Plan Admin',
    plan_trial:       'Essai gratuit',
    plan_free:        'Plan Gratuit',
    plan_inactive:    'Inactif',
    plan_trial_badge: 'Essai',
    days_left:        'j restants',
    subscribe_now:    "S'abonner maintenant",

    // Currency onboarding
    currency_onboarding_title: 'Quelle devise utilisez-vous ?',
    currency_onboarding_sub:   'Vous pourrez la changer à tout moment dans les réglages.',

    // Feedback
    feedback_btn:     'Envoyer mon avis',
    feedback_placeholder_long: 'Partagez votre expérience avec Kula...',

    // Chat UI
    tx_detected:          'Transaction détectée',
    saving:               'Enregistrement…',
    saved_offline_msg:    '📡 Sauvegardé hors ligne — sync dès reconnexion',
    chat_not_understood:  "Je n'ai pas compris. Pouvez-vous reformuler ?",
    confirm_delete_tx:    'Supprimer cette transaction ?',
    confirm_delete_pocket:'Supprimer cette poche ?',

    // Tour
    tour_skip:   'Passer',
    tour_next:   'Suivant →',
    tour_done:   'Terminer',
    tour_step1_title: '📊 Tableau de bord',
    tour_step1_desc:  'Suivez votre solde, revenus et dépenses du mois en un coup d\'œil.',
    tour_step2_title: '➕ Ajouter une transaction',
    tour_step2_desc:  'Appuyez ici pour enregistrer rapidement une dépense ou un revenu.',
    tour_step3_title: '🐷 Épargne',
    tour_step3_desc:  'Créez des poches d\'épargne pour vos projets et suivez votre progression.',
    tour_step4_title: '🌱 Coach IA',
    tour_step4_desc:  'Dites simplement "j\'ai dépensé 2500 FCFA au marché" — Kula enregistre tout.',
    tour_step5_title: '👤 Votre profil',
    tour_step5_desc:  'Gérez votre compte, devise, langue et abonnement ici.',

    // Chat welcome
    chat_welcome_title: 'Kula — Coach Financier 🌱',
    chat_welcome_body:  '👋 Bonjour ! Je suis <strong>Kula</strong>, ton coach financier 🌱<br><br>Je note tes dépenses et revenus, et je te donne des conseils personnalisés. Dis-moi simplement :<br><em>"Acheté manioc 2500 FCFA"</em><br><em>"Reçu salaire 250 000"</em><br><em>"Comment mieux épargner ?"</em>',

    // Toasts / messages
    saved:            'Enregistré',
    error:            'Erreur',
    offline:          'Mode hors ligne',
    payment_success:  'Paiement reçu ! Activation en cours…',
    payment_cancel:   'Paiement annulé.',
    name_updated:     'Nom mis à jour',
    photo_updated:    'Photo mise à jour',
    install_kula:     'Installer Kula sur mon téléphone',
    install_sub:      'Accès rapide, notifications & mises à jour'
  },

  en: {
    // Navigation
    nav_dashboard:    'Dashboard',
    nav_epargne:      'Savings',
    nav_transactions: 'History',
    nav_chat:         'AI Coach',

    // Header
    greeting_morning:   'Good morning',
    greeting_afternoon: 'Good afternoon',
    greeting_evening:   'Good evening',
    slogan:             'Grow your money',

    // Dashboard
    total_balance:    'Total balance',
    monthly_income:   'Income',
    monthly_expense:  'Expenses',
    this_month:       'This month',
    categories:       'Categories',
    trend:            'Trend',
    no_data:          'No data this month',

    // Transactions
    add:              'Add',
    cancel:           'Cancel',
    confirm:          'Confirm',
    save:             'Save',
    delete_btn:       'Delete',
    income:           'Income',
    expense:          'Expense',
    amount:           'Amount',
    category:         'Category',
    description:      'Description',
    date:             'Date',
    receipt:          'Receipt',
    no_transactions:  'No transactions',

    // Épargne
    savings:          'Savings',
    total_saved:      'Total saved',
    objective:        'Goal',
    pockets:          'pockets',
    new_pocket:       'New pocket',
    pocket_name:      'Pocket name',
    target_amount:    'Goal',
    target_date:      'Target date',
    optional:         'optional',
    create_pocket:    'Create pocket',
    add_funds:        'Add',
    goal_reached:     'Goal reached!',
    remaining:        'Remaining',

    // Budget
    budgets:          'Monthly budgets',
    of_budget:        'of budget',

    // Chat / Coach
    coach_title:      'Kula Coach',
    coach_placeholder:'Describe your expense or ask a question...',
    coach_welcome:    'Hi! I\'m your financial coach. Tell me what you spent or ask me for advice.',

    // Profile / Settings
    my_profile:       'My Profile',
    subscription:     'My subscription',
    currency:         'Currency',
    language:         'Language',
    feedback:         'Give feedback',
    feedback_placeholder: 'Your message (optional)',
    feedback_send:    'Send',
    feedback_thanks:  'Thank you for your feedback!',
    feedback_pick:    'Pick a rating (1 to 5 stars)',
    about:            'About',
    logout:           'Sign out',
    logout_confirm:   'Sign out of Kula?',
    member_since:     'Member since',

    // Plan
    plan_premium:     'Premium Plan',
    plan_admin:       'Admin Plan',
    plan_trial:       'Free trial',
    plan_free:        'Free Plan',
    plan_inactive:    'Inactive',
    plan_trial_badge: 'Trial',
    days_left:        'days left',
    subscribe_now:    'Subscribe now',

    // Currency onboarding
    currency_onboarding_title: 'Which currency do you use?',
    currency_onboarding_sub:   'You can change it anytime in settings.',

    // Feedback
    feedback_btn:     'Send my feedback',
    feedback_placeholder_long: 'Share your experience with Kula...',

    // Chat UI
    tx_detected:          'Transaction detected',
    saving:               'Saving…',
    saved_offline_msg:    '📡 Saved offline — will sync when reconnected',
    chat_not_understood:  "I didn't understand. Could you rephrase?",
    confirm_delete_tx:    'Delete this transaction?',
    confirm_delete_pocket:'Delete this pocket?',

    // Tour
    tour_skip:   'Skip',
    tour_next:   'Next →',
    tour_done:   'Done',
    tour_step1_title: '📊 Dashboard',
    tour_step1_desc:  'Track your balance, income and expenses at a glance.',
    tour_step2_title: '➕ Add a transaction',
    tour_step2_desc:  'Tap here to quickly record an expense or income.',
    tour_step3_title: '🐷 Savings',
    tour_step3_desc:  'Create savings pockets for your projects and track your progress.',
    tour_step4_title: '🌱 AI Coach',
    tour_step4_desc:  'Just say "I spent $5 at the market" — Kula records everything.',
    tour_step5_title: '👤 Your profile',
    tour_step5_desc:  'Manage your account, currency, language and subscription here.',

    // Chat welcome
    chat_welcome_title: 'Kula — Financial Coach 🌱',
    chat_welcome_body:  '👋 Hello! I\'m <strong>Kula</strong>, your financial coach 🌱<br><br>I track your expenses and income and give you personalized advice. Just tell me:<br><em>"Bought groceries $5"</em><br><em>"Received salary $500"</em><br><em>"How can I save more?"</em>',

    // Toasts / messages
    saved:            'Saved',
    error:            'Error',
    offline:          'Offline mode',
    payment_success:  'Payment received! Activating…',
    payment_cancel:   'Payment cancelled.',
    name_updated:     'Name updated',
    photo_updated:    'Photo updated',
    install_kula:     'Install Kula on my phone',
    install_sub:      'Quick access, notifications & updates'
  }
};

function t(key) {
  const lang = localStorage.getItem('kula_lang') || 'fr';
  return I18N[lang]?.[key] || I18N.fr[key] || key;
}

function applyI18n(lang) {
  if (!lang) lang = localStorage.getItem('kula_lang') || 'fr';
  const tr = I18N[lang] || I18N.fr;

  // Navigation tabs
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (tr[key]) el.textContent = tr[key];
  });

  // Specific elements by ID
  const map = {
    'profile-topbar-title': 'my_profile',
    'feedback-text':        null, // placeholder
    'install-prompt-title': 'install_kula',
    'install-prompt-sub':   'install_sub'
  };

  // All data-i18n-placeholder attributes
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (tr[key]) el.placeholder = tr[key];
  });

  // Feedback textarea placeholder
  const feedbackEl = document.getElementById('feedback-text');
  if (feedbackEl) feedbackEl.placeholder = tr.feedback_placeholder_long || tr.feedback_placeholder;

  // Chat topbar title
  const chatTopbar = document.querySelector('.chat-topbar-title');
  if (chatTopbar && tr.chat_welcome_title) chatTopbar.textContent = tr.chat_welcome_title;

  // Chat welcome bubble (first bot message)
  const chatWelcomeBubble = document.getElementById('chat-welcome-bubble');
  if (chatWelcomeBubble && tr.chat_welcome_body) chatWelcomeBubble.innerHTML = tr.chat_welcome_body;

  // Chat input placeholder
  const chatInput = document.getElementById('chat-input');
  if (chatInput && tr.coach_placeholder) chatInput.placeholder = tr.coach_placeholder;

  // Update greeting
  const user = typeof getUser === 'function' ? getUser() : {};
  if (user.name) {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? tr.greeting_morning : hour < 18 ? tr.greeting_afternoon : tr.greeting_evening;
    const el = document.getElementById('user-greeting');
    if (el) el.textContent = `${greeting}, ${user.name.split(' ')[0]} 👋`;
  }
}
