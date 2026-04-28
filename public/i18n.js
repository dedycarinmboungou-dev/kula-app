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
    slogan:             'Gérez vos budgets, simplement.',

    // Dashboard
    total_balance:    'Solde total',
    monthly_income:   'Revenus',
    monthly_expense:  'Dépenses',
    income_label:     'Revenus du mois',
    expense_label:    'Dépenses du mois',
    this_month:       'Ce mois',
    categories:       'Dépenses par catégorie',
    trend:            'Tendance',
    no_data:          'Aucune donnée ce mois',
    trend_6mo:        'Tendance 6 mois',
    recent_label:     'Récentes',
    see_all:          'Voir tout →',
    manage_budgets:   'Gérer mes budgets',
    export_pdf:       'Exporter le rapport PDF',
    install_btn:      'Installer',
    no_expense_month: 'Aucune dépense ce mois',
    use_chat_hint:    'Utilisez le chat pour ajouter vos dépenses et revenus',

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
    filter_all:       'Tout',

    // Add transaction sheet
    expense_tab:      'Dépense',
    income_tab:       'Revenu',
    specify_category: 'Précisez la catégorie…',
    desc_optional:    'Description (optionnel)',
    desc_placeholder: 'Ex : Course au marché…',
    receipt_optional: 'Justificatif (optionnel)',
    attach_photo:     'Joindre une photo',
    registering:      'Enregistrement…',
    expense_added:    '💸 Dépense ajoutée !',
    income_added:     '💰 Revenu ajouté !',
    invalid_amount:   'Montant invalide',
    select_category:  'Sélectionnez une catégorie',
    specify_cat:      'Précisez la catégorie',
    error_saving:     'Erreur lors de l\'enregistrement',

    // Épargne
    savings:          'Épargne',
    total_saved:      'Total épargné',
    objective:        'Objectif',
    pockets:          'poches',
    my_pockets:       'Mes Poches',
    new_pocket:       'Nouvelle poche',
    new_pocket_title: 'Nouvelle poche d\'épargne',
    pocket_name:      'Nom de la poche',
    pocket_name_placeholder: 'ex : Voiture, Voyage, Téléphone…',
    target_amount:    'Objectif',
    target_date:      'Date cible',
    optional:         'optionnel',
    create_pocket:    'Créer la poche',
    create_pocket_btn:'Créer la poche 🐷',
    creating:         'Création…',
    add_funds:        'Ajouter',
    add_funds_btn:    'Ajouter 💰',
    adding:           'Ajout…',
    amount_to_add:    'Montant à ajouter',
    goal_reached:     'Objectif atteint !',
    goal_reached_msg: 'Objectif atteint !',
    remaining:        'Reste',
    no_pockets:       'Aucune poche d\'épargne',
    no_pockets_sub:   'Crée ta première poche pour commencer !',
    pocket_created:   'Poche créée',
    pocket_deleted:   'Poche supprimée',
    amount_added:     'Montant ajouté 💰',
    name_required:    'Le nom est requis',
    goal_invalid:     'Objectif invalide',

    // Budget
    budgets:          'Budgets mensuels',
    of_budget:        'du budget',
    budget_hint:      'Définissez une limite mensuelle par catégorie. Laissez vide pour désactiver.',
    budget_saved:     'Budget enregistré',
    budget_removed:   'Budget supprimé',

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
    edit_name:        'Modifier',
    your_name:        'Votre nom',
    change_photo:     'Changer la photo',
    name_empty:       'Le nom ne peut pas être vide',

    // Plan
    plan_premium:     'Plan Premium',
    plan_admin:       'Plan Admin',
    plan_trial:       'Essai gratuit',
    plan_free:        'Plan Gratuit',
    plan_inactive:    'Inactif',
    plan_trial_badge: 'Essai',
    days_left:        'j restants',
    subscribe_now:    'S\'abonner maintenant',
    next_payment:     'Prochain paiement le',
    unlimited_access: 'Accès illimité',
    expires_on:       'Expire le',
    plan_free_desc:   'Passez Premium pour accéder à toutes les fonctionnalités',
    day_left:         'jour restant',
    trial_last_day:   'Dernier jour',
    upgrade_premium:  'Passer Premium',
    trial_expired:    'Votre essai de 3 jours est terminé',
    connecting_payment: 'Connexion au paiement…',
    payment_error:    'Erreur lors du paiement',
    secure_payment:   '🔒 Paiement sécurisé · Annulable à tout moment',

    // Paywall features
    pw_feat_coach:    'Coach Kula IA illimité',
    pw_feat_tx:       'Transactions & historique complet',
    pw_feat_savings:  'Poches d\'épargne & budgets',
    pw_feat_pdf:      'Rapports PDF & analyses',
    pw_feat_notif:    'Notifications intelligentes',

    // PDF
    export_pdf_title: 'Exporter en PDF',
    choose_month:     'Choisir le mois',
    report_kula:      'Rapport Kula',
    report_sub:       'Transactions · Catégories · Conseil Kula',
    download_pdf:     'Télécharger le PDF',
    generating:       'Génération en cours…',
    report_downloaded:'Rapport téléchargé ✅',

    // Category management
    new_category:     'Nouvelle catégorie',
    edit_category:    'Modifier la catégorie',
    cat_name:         'Nom',
    cat_name_placeholder: 'ex : Courses, Loyer, Épargne…',
    cat_icon:         'Icône (emoji)',
    cat_color:        'Couleur',
    cat_type:         'Type',
    cat_both:         'Les deux',
    cat_create:       'Créer',
    cat_created:      'Catégorie créée',
    cat_updated:      'Catégorie mise à jour',
    cat_deleted:      'Catégorie supprimée',
    new_cat_btn:      '+ Nouvelle',

    // Score Kula
    score_great_status:        '💚 Excellente gestion',
    score_great_detail_savings:'Tu épargnes ~{X}% de tes revenus ce mois. Continue !',
    score_great_detail_default:'Tes finances sont sous contrôle.',
    score_good_status:         '✅ Bonne gestion',
    score_good_detail_savings: 'Tu mets de côté {X}% de tes revenus. Bien joué !',
    score_good_detail_default: 'Tes dépenses restent raisonnables.',
    score_warn_status:         '⚠️ Attention requise',
    score_warn_detail_over:    'Dépenses supérieures aux revenus ce mois.',
    score_warn_detail_budget:  'Certains budgets sont proches de leur limite.',
    score_bad_status:          '🔴 Finances tendues',
    score_bad_detail_over:     'Tu dépenses plus que tu ne gagnes. Parle à Kula.',
    score_bad_detail_budget:   'Plusieurs budgets sont dépassés.',

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
    chat_not_understood:  'Je n\'ai pas compris. Pouvez-vous reformuler ?',
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
    chat_welcome_body:  '👋 Bonjour ! Je suis <strong>Kula</strong>, votre assistant budget 🌱<br><br>Je note les dépenses et revenus de vos projets, et je vous fournis des analyses détaillées. Dites-moi simplement :<br><em>"J\'ai payé le traiteur 45 000 FCFA"</em><br><em>"Achat de fournitures de bureau 12 000 FCFA"</em><br><em>"Transport pour la réunion 3 500 FCFA"</em>',

    // Toasts / messages
    saved:            'Enregistré',
    error:            'Erreur',
    offline:          'Mode hors ligne',
    payment_success:  'Paiement reçu ! Activation en cours…',
    payment_cancel:   'Paiement annulé.',
    name_updated:     'Nom mis à jour',
    photo_updated:    'Photo mise à jour ✓',
    install_kula:     'Installer Kula sur mon téléphone',
    install_sub:      'Accès rapide, notifications & mises à jour',
    tx_deleted:       'Transaction supprimée',
    connection_restored: 'Connexion rétablie 🌐',
    synced_msg:       'transaction(s) synchronisée(s) ✅',
    error_loading:    'Erreur lors du chargement',
    error_dashboard:  'Erreur tableau de bord',
    loading:          'Chargement…',
    photo_too_large:  'Image trop grande (max 5 Mo)',
    name_required_err:'Nom requis',

    // Offline
    sync_btn:         'Synchroniser',
    tx_pending:       'transaction(s) en attente de sync',

    // Voice
    listening:        'Écoute en cours…',
    voice_processing: 'Traitement vocal…',
    no_speech:        'Aucune parole détectée. Réessaie.',
    mic_denied:       'Accès au micro refusé. Autorisez-le dans votre navigateur.',
    voice_error:      'Erreur vocale',
    voice_unavailable:'Reconnaissance vocale non disponible sur ce navigateur.',

    // Update
    new_version:      '🔄 Nouvelle version disponible',
    update_btn:       'Mettre à jour',

    // About
    about_desc:       'Kula (mot Kituba signifiant « grandir ») est votre coach financier personnel propulsé par l\'intelligence artificielle, conçu pour les entrepreneurs et familles d\'Afrique. Notez vos revenus et dépenses, suivez vos budgets, épargnez pour vos projets et recevez des conseils personnalisés grâce à l\'IA.',
    about_legal:      '© 2026 MindUp Academy. Tous droits réservés.',

    // Errors
    unknown_error:    'Erreur inconnue',
    error_prefix:     'Erreur',
    error_network:    'Erreur réseau. Réessaie.',
    error_payment:    'Erreur lors de l\'initiation du paiement.',
    error_save_prefix:'Erreur sauvegarde',
    error_timeout:    'Serveur non disponible — réessaie dans quelques secondes',
    confirm_delete_cat:'Supprimer la catégorie',

    // Language toast
    lang_changed:     'Langue : Français',

    // Chat transaction
    tx_cancelled:     'Transaction annulée',
    tx_registered:    'transaction(s) enregistrée(s) ✅',

    // Notifications
    notif_afternoon:  '☀️ Pause déjeuner ! Quelques dépenses à enregistrer dans Kula ?',
    notif_evening:    '🌙 Bonsoir ! Prends 2 minutes pour faire le bilan de ta journée.',
    notif_quote:      '💡 Citation du jour',

    // Inactivity reminders
    reminder_1d:      'Tu n\'as rien enregistré aujourd\'hui. Une petite dépense oubliée ?',
    reminder_2d:      'Ça fait 2 jours sans transaction. Ton budget attend une mise à jour !',
    reminder_3d:      '3 jours sans mise à jour — prends 2 minutes pour noter tes dépenses.',
    reminder_7d:      'Une semaine sans suivi ! Pour bien grandir, Kula a besoin de tes transactions.',
    reminder_long:    'Ça fait longtemps ! Reviens noter tes finances, tu es le patron de ton argent.',

    // Reminder banner
    reminder_add:     'Ajouter',
    reminder_close:   'Fermer',

    // PWA install guide
    pwa_install_title:'📲 Installer Kula',
    pwa_android_step1:'Appuie sur le bouton "Installer"',
    pwa_android_step2:'Une fenêtre s\'ouvre — appuie sur <strong>Installer</strong>',
    pwa_android_step3:'C\'est fait ! L\'icône Kula apparaît sur ton écran 🎉',
    pwa_android_btn:  'Installer maintenant ↗',
    pwa_mockup_install_banner: '📲 Installer Kula sur mon téléphone',
    pwa_mockup_cancel:'Annuler',
    pwa_mockup_install:'Installer',
    pwa_safari_step1: 'Appuie sur <strong>Partager</strong> <span class="pwa-icon-share">⬆</span> en bas de Safari',
    pwa_safari_step2: 'Appuie sur <strong>"Sur l\'écran d\'accueil"</strong>',
    pwa_safari_step3: 'Appuie sur <strong>"Ajouter"</strong> en haut à droite',
    pwa_mockup_copy:  '📋 Copier',
    pwa_mockup_homescreen: '＋ Sur l\'écran d\'accueil',
    pwa_mockup_bookmarks: '📌 Ajouter aux favoris',
    pwa_mockup_add:   'Ajouter',
    pwa_chrome_step1: 'Appuie sur <strong>⋮</strong> en haut à droite',
    pwa_chrome_step2: 'Appuie sur <strong>"Ajouter à l\'écran d\'accueil"</strong>',
    pwa_chrome_step3: 'Confirme en appuyant sur <strong>"Ajouter"</strong>',
    pwa_mockup_share: '📤 Partager…',
    pwa_mockup_add_home: '＋ Ajouter à l\'écran d\'accueil',
    pwa_mockup_download: '⬇️ Télécharger la page',

    // Offline data banner
    offline_data:     '📵 Mode hors ligne · données du',
    offline_last:     'dernière connexion',

    // Profile edit
    edit_name_btn:    'Modifier',
    save_btn:         'Enregistrer',
    cancel_btn:       'Annuler',
    your_name_placeholder: 'Votre nom',

    // Voice panel
    voice_rec_label:  'Écoute en cours…',
    voice_processing_label: 'Traitement vocal…',
    voice_stop_title: 'Terminer l\'enregistrement',
    voice_cancel_title: 'Annuler',

    // Category modal
    cat_type_expense: 'Dépense',
    cat_type_income:  'Revenu',
    cat_type_both:    'Les deux',
    cat_expenses_title:'Catégories de dépenses',

    // Savings
    pocket_unit:      'poche',
    pocket_unit_plural:'poches',
    add_to_pocket:    '+ Ajouter',
    deadline_passed:  'Échéance dépassée',
    days_short:       'j',

    // Welcome popup
    welcome_title:    'Bienvenue sur Kula !',
    welcome_sub:      'Kula vous permet de gérer les finances de vos projets personnels, associatifs ou professionnels. Créez un espace, ajoutez vos dépenses en langage naturel, invitez vos collaborateurs et générez des rapports détaillés en un clic.',
    welcome_step1_title: 'Parlez naturellement',
    welcome_step1_sub:   '«\u00a0J\'ai payé le traiteur 45 000 FCFA\u00a0»',
    welcome_step2_title: 'L\'IA classe automatiquement',
    welcome_step2_sub:   'Catégorie, montant, date — tout est géré',
    welcome_step3_title: 'Suivez votre budget en temps réel',
    welcome_step3_sub:   'Tableau de bord, tendances, catégories',
    welcome_btn:      'C\'est parti ! 🚀',

    // Goal notification
    goal_congrats_title: 'Kula 🌱 — Félicitations !',
    goal_congrats_body:  '🎉 Félicitations ! Tu as atteint ton objectif',
    goal_toast:       '🎉 Objectif atteint !',

    // Projects (multi-projet)
    projects:              'Projets',
    new_project:           'Nouveau projet',
    create:                'Créer',
    back:                  'Retour',
    project_name:          'Nom du projet',
    project_name_ph:       'Ex : Mariage de Fatou',
    project_type:          'Type',
    project_type_perso:    'Perso',
    project_type_entreprise:'Entreprise',
    project_type_asso:     'Association',
    project_type_event:    'Événement',
    project_members:       'Membres',
    invite_member:         'Inviter un membre',
    invite:                'Inviter',
    enter_email:           'email@exemple.com',
    invalid_email:         'Email invalide',
    project_no_members:    'Aucun membre invité',
    project_status_accepted: 'Accepté',
    project_status_pending:  'En attente',
    project_invite_sent:   'Invitation envoyée',
    project_created:       'Projet créé',
    project_switched:      'Projet sélectionné',
    project_name_required: 'Le nom du projet est requis',
    project_manage:        'Gérer le projet',
    loading:               'Chargement…'
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
    slogan:             'Manage your budgets, simply.',

    // Dashboard
    total_balance:    'Total balance',
    monthly_income:   'Income',
    monthly_expense:  'Expenses',
    income_label:     'Monthly income',
    expense_label:    'Monthly expenses',
    this_month:       'This month',
    categories:       'Expenses by category',
    trend:            'Trend',
    no_data:          'No data this month',
    trend_6mo:        '6-month trend',
    recent_label:     'Recent',
    see_all:          'See all →',
    manage_budgets:   'Manage my budgets',
    export_pdf:       'Export PDF report',
    install_btn:      'Install',
    no_expense_month: 'No expenses this month',
    use_chat_hint:    'Use the chat to add your expenses and income',

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
    filter_all:       'All',

    // Add transaction sheet
    expense_tab:      'Expense',
    income_tab:       'Income',
    specify_category: 'Specify category…',
    desc_optional:    'Description (optional)',
    desc_placeholder: 'E.g.: Grocery shopping…',
    receipt_optional: 'Receipt (optional)',
    attach_photo:     'Attach a photo',
    registering:      'Saving…',
    expense_added:    '💸 Expense added!',
    income_added:     '💰 Income added!',
    invalid_amount:   'Invalid amount',
    select_category:  'Select a category',
    specify_cat:      'Specify the category',
    error_saving:     'Error saving',

    // Épargne
    savings:          'Savings',
    total_saved:      'Total saved',
    objective:        'Goal',
    pockets:          'pockets',
    my_pockets:       'My Pockets',
    new_pocket:       'New pocket',
    new_pocket_title: 'New savings pocket',
    pocket_name:      'Pocket name',
    pocket_name_placeholder: 'e.g.: Car, Travel, Phone…',
    target_amount:    'Goal',
    target_date:      'Target date',
    optional:         'optional',
    create_pocket:    'Create pocket',
    create_pocket_btn:'Create pocket 🐷',
    creating:         'Creating…',
    add_funds:        'Add',
    add_funds_btn:    'Add 💰',
    adding:           'Adding…',
    amount_to_add:    'Amount to add',
    goal_reached:     'Goal reached!',
    goal_reached_msg: 'Goal reached!',
    remaining:        'Remaining',
    no_pockets:       'No savings pockets',
    no_pockets_sub:   'Create your first pocket to get started!',
    pocket_created:   'Pocket created',
    pocket_deleted:   'Pocket deleted',
    amount_added:     'Amount added 💰',
    name_required:    'Name is required',
    goal_invalid:     'Invalid goal',

    // Budget
    budgets:          'Monthly budgets',
    of_budget:        'of budget',
    budget_hint:      'Set a monthly limit per category. Leave empty to disable.',
    budget_saved:     'Budget saved',
    budget_removed:   'Budget removed',

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
    edit_name:        'Edit',
    your_name:        'Your name',
    change_photo:     'Change photo',
    name_empty:       'Name cannot be empty',

    // Plan
    plan_premium:     'Premium Plan',
    plan_admin:       'Admin Plan',
    plan_trial:       'Free trial',
    plan_free:        'Free Plan',
    plan_inactive:    'Inactive',
    plan_trial_badge: 'Trial',
    days_left:        'days left',
    subscribe_now:    'Subscribe now',
    next_payment:     'Next payment on',
    unlimited_access: 'Unlimited access',
    expires_on:       'Expires on',
    plan_free_desc:   'Go Premium to access all features',
    day_left:         'day left',
    trial_last_day:   'Last day',
    upgrade_premium:  'Upgrade to Premium',
    trial_expired:    'Your 3-day trial has ended',
    connecting_payment: 'Connecting to payment…',
    payment_error:    'Payment error',
    secure_payment:   '🔒 Secure payment · Cancel anytime',

    // Paywall features
    pw_feat_coach:    'Unlimited Kula AI Coach',
    pw_feat_tx:       'Complete transactions & history',
    pw_feat_savings:  'Savings pockets & budgets',
    pw_feat_pdf:      'PDF reports & analytics',
    pw_feat_notif:    'Smart notifications',

    // PDF
    export_pdf_title: 'Export as PDF',
    choose_month:     'Choose month',
    report_kula:      'Kula Report',
    report_sub:       'Transactions · Categories · Kula Advice',
    download_pdf:     'Download PDF',
    generating:       'Generating…',
    report_downloaded:'Report downloaded ✅',

    // Category management
    new_category:     'New category',
    edit_category:    'Edit category',
    cat_name:         'Name',
    cat_name_placeholder: 'e.g.: Groceries, Rent, Savings…',
    cat_icon:         'Icon (emoji)',
    cat_color:        'Color',
    cat_type:         'Type',
    cat_both:         'Both',
    cat_create:       'Create',
    cat_created:      'Category created',
    cat_updated:      'Category updated',
    cat_deleted:      'Category deleted',
    new_cat_btn:      '+ New',

    // Score Kula
    score_great_status:        '💚 Excellent management',
    score_great_detail_savings:'You\'re saving ~{X}% of your income this month. Keep it up!',
    score_great_detail_default:'Your finances are under control.',
    score_good_status:         '✅ Good management',
    score_good_detail_savings: 'You\'re setting aside {X}% of your income. Well done!',
    score_good_detail_default: 'Your expenses remain reasonable.',
    score_warn_status:         '⚠️ Attention needed',
    score_warn_detail_over:    'Expenses exceed income this month.',
    score_warn_detail_budget:  'Some budgets are near their limit.',
    score_bad_status:          '🔴 Tight finances',
    score_bad_detail_over:     'You\'re spending more than you earn. Talk to Kula.',
    score_bad_detail_budget:   'Several budgets are exceeded.',

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
    chat_not_understood:  'I didn\'t understand. Could you rephrase?',
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
    chat_welcome_body:  '👋 Hello! I\'m <strong>Kula</strong>, your budget assistant 🌱<br><br>I track your projects\' expenses and income, and provide detailed analytics. Just tell me:<br><em>"Paid the caterer $75"</em><br><em>"Office supplies purchase $20"</em><br><em>"Transport for the meeting $6"</em>',

    // Toasts / messages
    saved:            'Saved',
    error:            'Error',
    offline:          'Offline mode',
    payment_success:  'Payment received! Activating…',
    payment_cancel:   'Payment cancelled.',
    name_updated:     'Name updated',
    photo_updated:    'Photo updated ✓',
    install_kula:     'Install Kula on my phone',
    install_sub:      'Quick access, notifications & updates',
    tx_deleted:       'Transaction deleted',
    connection_restored: 'Connection restored 🌐',
    synced_msg:       'transaction(s) synced ✅',
    error_loading:    'Error loading data',
    error_dashboard:  'Dashboard error',
    loading:          'Loading…',
    photo_too_large:  'Image too large (max 5 MB)',
    name_required_err:'Name required',

    // Offline
    sync_btn:         'Sync',
    tx_pending:       'transaction(s) pending sync',

    // Voice
    listening:        'Listening…',
    voice_processing: 'Processing voice…',
    no_speech:        'No speech detected. Try again.',
    mic_denied:       'Microphone access denied. Enable it in your browser.',
    voice_error:      'Voice error',
    voice_unavailable:'Voice recognition not available in this browser.',

    // Update
    new_version:      '🔄 New version available',
    update_btn:       'Update',

    // About
    about_desc:       'Kula (a Kituba word meaning "to grow") is your personal AI-powered financial coach, designed for African entrepreneurs and families. Track your income and expenses, manage your budgets, save for your goals and receive personalized advice from AI.',
    about_legal:      '© 2026 MindUp Academy. All rights reserved.',

    // Errors
    unknown_error:    'Unknown error',
    error_prefix:     'Error',
    error_network:    'Network error. Try again.',
    error_payment:    'Error initiating payment.',
    error_save_prefix:'Save error',
    error_timeout:    'Server unavailable — try again in a few seconds',
    confirm_delete_cat:'Delete category',

    // Language toast
    lang_changed:     'Language: English',

    // Chat transaction
    tx_cancelled:     'Transaction cancelled',
    tx_registered:    'transaction(s) saved ✅',

    // Notifications
    notif_afternoon:  '☀️ Lunch break! Any expenses to record in Kula?',
    notif_evening:    '🌙 Good evening! Take 2 minutes to review your day.',
    notif_quote:      '💡 Quote of the day',

    // Inactivity reminders
    reminder_1d:      'Nothing recorded today. Forgot a small expense?',
    reminder_2d:      '2 days without a transaction. Your budget needs an update!',
    reminder_3d:      '3 days without an update — take 2 minutes to log your expenses.',
    reminder_7d:      'A week without tracking! Kula needs your transactions to help you grow.',
    reminder_long:    'It\'s been a while! Come back and track your finances — you\'re the boss of your money.',

    // Reminder banner
    reminder_add:     'Add',
    reminder_close:   'Close',

    // PWA install guide
    pwa_install_title:'📲 Install Kula',
    pwa_android_step1:'Tap the "Install" button',
    pwa_android_step2:'A dialog opens — tap <strong>Install</strong>',
    pwa_android_step3:'Done! The Kula icon appears on your screen 🎉',
    pwa_android_btn:  'Install now ↗',
    pwa_mockup_install_banner: '📲 Install Kula on my phone',
    pwa_mockup_cancel:'Cancel',
    pwa_mockup_install:'Install',
    pwa_safari_step1: 'Tap <strong>Share</strong> <span class="pwa-icon-share">⬆</span> at the bottom of Safari',
    pwa_safari_step2: 'Tap <strong>"Add to Home Screen"</strong>',
    pwa_safari_step3: 'Tap <strong>"Add"</strong> in the top right',
    pwa_mockup_copy:  '📋 Copy',
    pwa_mockup_homescreen: '＋ Add to Home Screen',
    pwa_mockup_bookmarks: '📌 Add to Bookmarks',
    pwa_mockup_add:   'Add',
    pwa_chrome_step1: 'Tap <strong>⋮</strong> in the top right',
    pwa_chrome_step2: 'Tap <strong>"Add to Home Screen"</strong>',
    pwa_chrome_step3: 'Confirm by tapping <strong>"Add"</strong>',
    pwa_mockup_share: '📤 Share…',
    pwa_mockup_add_home: '＋ Add to Home Screen',
    pwa_mockup_download: '⬇️ Download page',

    // Offline data banner
    offline_data:     '📵 Offline mode · data from',
    offline_last:     'last connection',

    // Profile edit
    edit_name_btn:    'Edit',
    save_btn:         'Save',
    cancel_btn:       'Cancel',
    your_name_placeholder: 'Your name',

    // Voice panel
    voice_rec_label:  'Listening…',
    voice_processing_label: 'Processing voice…',
    voice_stop_title: 'Stop recording',
    voice_cancel_title: 'Cancel',

    // Category modal
    cat_type_expense: 'Expense',
    cat_type_income:  'Income',
    cat_type_both:    'Both',
    cat_expenses_title:'Expense categories',

    // Savings
    pocket_unit:      'pocket',
    pocket_unit_plural:'pockets',
    add_to_pocket:    '+ Add',
    deadline_passed:  'Deadline passed',
    days_short:       'd',

    // Welcome popup
    welcome_title:    'Welcome to Kula!',
    welcome_sub:      'Kula helps you manage the finances of your personal, community or professional projects. Create a space, add expenses in natural language, invite collaborators and generate detailed reports in one click.',
    welcome_step1_title: 'Speak naturally',
    welcome_step1_sub:   '"Paid the caterer $75"',
    welcome_step2_title: 'AI categorizes automatically',
    welcome_step2_sub:   'Category, amount, date — all handled',
    welcome_step3_title: 'Track your budget in real time',
    welcome_step3_sub:   'Dashboard, trends, categories',
    welcome_btn:      'Let\'s go! 🚀',

    // Goal notification
    goal_congrats_title: 'Kula 🌱 — Congratulations!',
    goal_congrats_body:  '🎉 Congratulations! You reached your goal',
    goal_toast:       '🎉 Goal reached!',

    // Projects (multi-project)
    projects:              'Projects',
    new_project:           'New project',
    create:                'Create',
    back:                  'Back',
    project_name:          'Project name',
    project_name_ph:       'E.g. Fatou\'s Wedding',
    project_type:          'Type',
    project_type_perso:    'Personal',
    project_type_entreprise:'Business',
    project_type_asso:     'Association',
    project_type_event:    'Event',
    project_members:       'Members',
    invite_member:         'Invite a member',
    invite:                'Invite',
    enter_email:           'email@example.com',
    invalid_email:         'Invalid email',
    project_no_members:    'No members invited yet',
    project_status_accepted: 'Accepted',
    project_status_pending:  'Pending',
    project_invite_sent:   'Invitation sent',
    project_created:       'Project created',
    project_switched:      'Project switched',
    project_name_required: 'Project name is required',
    project_manage:        'Manage project',
    loading:               'Loading…'
  }
};

function t(key) {
  const lang = localStorage.getItem('kula_lang') || 'fr';
  return I18N[lang]?.[key] || I18N.fr[key] || key;
}

function applyI18n(lang) {
  if (!lang) lang = localStorage.getItem('kula_lang') || 'fr';
  const tr = I18N[lang] || I18N.fr;

  // All [data-i18n] elements
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (tr[key]) el.textContent = tr[key];
  });

  // All [data-i18n-html] elements (innerHTML)
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.dataset.i18nHtml;
    if (tr[key]) el.innerHTML = tr[key];
  });

  // Specific elements by ID
  const idMap = {
    'profile-topbar-title': 'my_profile',
    'about-desc':           'about_desc',
    'about-legal':          'about_legal'
  };
  Object.entries(idMap).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el && tr[key]) el.textContent = tr[key];
  });

  // All data-i18n-placeholder attributes
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (tr[key]) el.placeholder = tr[key];
  });

  // All data-i18n-title attributes
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.dataset.i18nTitle;
    if (tr[key]) el.title = tr[key];
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
