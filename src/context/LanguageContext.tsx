"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type SupportedLanguage = "en" | "pt" | "es";

type Translations = Record<string, Record<SupportedLanguage, string>>;

const translations: Translations = {
  // Navigation
  nav_dashboard: { en: "Dashboard", pt: "Painel", es: "Panel" },
  nav_study: { en: "Study", pt: "Estudo", es: "Estudio" },
  nav_flashcards: { en: "Flashcards", pt: "Flashcards", es: "Fichas" },
  nav_results: { en: "Results", pt: "Resultados", es: "Resultados" },
  nav_progress: { en: "Progress", pt: "Progresso", es: "Progreso" },
  nav_settings: { en: "Settings", pt: "Configurações", es: "Configuración" },
  nav_whatsapp: { en: "WhatsApp", pt: "WhatsApp", es: "WhatsApp" },
  lang_en: { en: "English", pt: "Inglês", es: "Inglés" },
  lang_pt: { en: "Português", pt: "Português", es: "Portugués" },
  lang_es: { en: "Español", pt: "Espanhol", es: "Español" },

  // Home / General
  welcome_back: { en: "Welcome back", pt: "Bem-vindo de volta", es: "Bienvenido de nuevo" },
  total_sessions: { en: "Total sessions", pt: "Total de sessões", es: "Total de sesiones" },
  completion_rate: { en: "Completion rate", pt: "Taxa de conclusão", es: "Tasa de finalización" },
  most_used_mode: { en: "Most used mode", pt: "Modo mais usado", es: "Modo más usado" },
  open_sessions: { en: "Open sessions", pt: "Sessões abertas", es: "Sesiones abiertas" },
  activity: { en: "Activity", pt: "Atividade", es: "Actividad" },
  mode_mix: { en: "Mode mix", pt: "Distribuição de modos", es: "Mezcla de modos" },
  status_mix: { en: "Status mix", pt: "Status das sessões", es: "Estado de sesiones" },
  study_hub: { en: "Study hub", pt: "Central de Estudos", es: "Centro de Estudio" },
  quick_navigation: { en: "Quick navigation", pt: "Navegação rápida", es: "Navegación rápida" },
  open_study: { en: "Open Study", pt: "Abrir Estudos", es: "Abrir Estudio" },
  continue_google: { en: "Continue with Google", pt: "Continuar com o Google", es: "Continuar con Google" },
  sign_out: { en: "Sign out", pt: "Sair da conta", es: "Cerrar sesión" },
  day_streak: { en: "day streak", pt: "dias seguidos", es: "días seguidos" },
  daily_goal: { en: "Daily Goal", pt: "Meta Diária", es: "Meta Diaria" },
  break_timer: { en: "USMLE 2026 Break Timer", pt: "Cronômetro de Pausa USMLE 2026", es: "Temporizador de Pausa USMLE 2026" },
  log_practice_exam: { en: "Log Practice Exam (NBME / Free 120)", pt: "Registrar Simulado (NBME / Free 120)", es: "Registrar Examen (NBME / Free 120)" },
  last_14_days: { en: "Last 14 days", pt: "Últimos 14 dias", es: "Últimos 14 días" },
  peak_label: { en: "Peak:", pt: "Pico:", es: "Pico:" },
  how_you_study: { en: "How you study", pt: "Como você estuda", es: "Cómo estudias" },
  sessions_label: { en: "sessions", pt: "sessões", es: "sesiones" },
  completion_profile: { en: "Completion profile", pt: "Perfil de conclusão", es: "Perfil de finalización" },
  done_label: { en: "done", pt: "concluído", es: "completado" },
  study_hub_desc: { en: "Go to Study to start Practice, Timed block, or Partial simulation.", pt: "Acesse a Central de Estudos para praticar, fazer blocos temporizados ou simulados.", es: "Accede al Centro de Estudio para practicar, hacer bloques temporizados o simulaciones." },
  to_next_level: { en: "to next level", pt: "para o próximo nível", es: "para el siguiente nivel" },
  weekly_momentum_desc: { en: "Start one focused block to open your weekly momentum.", pt: "Inicie um bloco focado para abrir seu ritmo semanal.", es: "Inicia un bloque enfocado para abrir tu ritmo semanal." },
  clear_queue: { en: "Clear", pt: "Livre", es: "Sin pendientes" },
  momentum_action_hint: { en: "Start one focused block to open your weekly momentum.", pt: "Inicie um bloco focado para abrir seu ritmo semanal.", es: "Inicia un bloque enfocado para abrir tu ritmo semanal." },
  review_action_hint: { en: "Track accuracy, timing, and completed sessions.", pt: "Acompanhe precisão, tempo e sessões concluídas.", es: "Haz seguimiento de precisión, tiempo y sesiones completadas." },
  footer_learning: { en: "Built for medical learning", pt: "Desenvolvido para aprendizado médico", es: "Desarrollado para el aprendizaje médico" },

  // Public Landing / Home
  hero_title_1: { en: "USMLE study,", pt: "Estudo USMLE,", es: "Estudio USMLE," },
  hero_title_2: { en: "with a cleaner flow", pt: "com fluxo mais inteligente", es: "con un flujo más fluido" },
  built_by_helpus: { en: "Built by HelpUS", pt: "Desenvolvido por HelpUS", es: "Desarrollado por HelpUS" },
  practice_title: { en: "Practice", pt: "Prática", es: "Práctica" },
  practice_desc: { en: "Untimed learning with immediate feedback.", pt: "Aprendizado sem tempo e com feedback imediato.", es: "Aprendizaje sin tiempo con retroalimentación inmediata." },
  timed_blocks_title: { en: "Timed blocks", pt: "Blocos Temporizados", es: "Bloques Temporizados" },
  timed_blocks_desc: { en: "Pacing-focused study without mid-session answers.", pt: "Treino de ritmo de prova sem respostas no meio.", es: "Entrenamiento de ritmo de examen sin respuestas a mitad del bloque." },
  simulation_title: { en: "Simulation", pt: "Simulado", es: "Simulación" },
  simulation_desc: { en: "Longer exam-style flows with deferred review.", pt: "Simulações de exame completas com revisão posterior.", es: "Flujos de examen más largos con revisión posterior." },
  continue_account: { en: "Continue with your account", pt: "Continuar com sua conta", es: "Continuar con tu cuenta" },
  after_login_title: { en: "What happens after login", pt: "O que acontece após o login", es: "Qué sucede después de iniciar sesión" },
  feature_1: { en: "Visual dashboard with study momentum", pt: "Painel visual com métricas de estudo", es: "Panel visual con impulso de estudio" },
  feature_2: { en: "Dedicated Study hub for starting and resuming sessions", pt: "Central de estudos para iniciar e retomar sessões", es: "Centro de estudios dedicado para iniciar y reanudar sesiones" },
  feature_3: { en: "Results and Progress as separate views", pt: "Resultados e Progresso em telas dedicadas", es: "Resultados y Progreso como vistas independientes" },
  feature_4: { en: "Session continuity across visits", pt: "Continuidade de sessões em todos os seus acessos", es: "Continuidad de sesión en todas tus visitas" },

  // Study Page & Hero
  daily_study_arena: { en: "Daily study arena", pt: "Arena Diária de Estudo", es: "Arena Diaria de Estudio" },
  keep_streak_alive: { en: "Keep your streak alive.", pt: "Mantenha sua sequência ativa.", es: "Mantén tu racha activa." },
  signed_in_as: { en: "Signed in as", pt: "Conectado como", es: "Sesión iniciada como" },
  next_block_ready: { en: "Your next block is ready for", pt: "Seu próximo bloco está pronto para", es: "Tu próximo bloque está listo para" },
  sign_in_save_progress: { en: "Sign in to save progress.", pt: "Faça login para salvar o progresso.", es: "Inicia sesión para guardar tu progreso." },
  this_week: { en: "This week", pt: "Esta semana", es: "Esta semana" },
  default_pill: { en: "Default", pt: "Padrão", es: "Predeterminado" },
  mode_pill: { en: "Mode", pt: "Modo", es: "Modo" },
  todays_mission: { en: "Today's mission", pt: "Missão de hoje", es: "Misión de hoy" },
  continue_your_run: { en: "Continue your run.", pt: "Continue de onde parou.", es: "Continúa donde lo dejaste." },
  complete_focused_block: { en: "Complete one focused official-format block.", pt: "Conclua um bloco no formato oficial.", es: "Completa un bloque enfocado en formato oficial." },
  start_todays_block: { en: "Start today's block", pt: "Iniciar bloco de hoje", es: "Iniciar bloque de hoy" },
  continue_mode: { en: "Continue", pt: "Continuar", es: "Continuar" },
  resume_mode: { en: "Resume", pt: "Retomar", es: "Reanudar" },
  quick_start: { en: "Quick start", pt: "Início rápido", es: "Inicio rápido" },
  pick_next_move: { en: "Pick the next move for", pt: "Escolha o próximo passo para", es: "Elige el siguiente paso para" },
  built_for_mobile: { en: "Built for short, high-frequency mobile sessions.", pt: "Feito para sessões rápidas e de alta frequência.", es: "Diseñado para sesiones cortas y de alta frecuencia." },
  review_card_title: { en: "Review", pt: "Revisão", es: "Revisión" },
  review_card_subtitle: { en: "Missed & recent", pt: "Erradas e recentes", es: "Falladas y recientes" },
  soon_badge: { en: "Soon", pt: "Em breve", es: "Próximamente" },
  continue_section: { en: "Continue", pt: "Continuar sessão", es: "Continuar sesión" },
  resume_current_session: { en: "Resume current session", pt: "Retomar sessão atual", es: "Reanudar sesión actual" },
  no_open_session: { en: "No open session right now.", pt: "Nenhuma sessão em andamento.", es: "No hay ninguna sesión abierta en este momento." },
  recent_completed: { en: "Recent completed", pt: "Concluídas recentes", es: "Completadas recientes" },
  no_completed_sessions: { en: "No completed sessions yet.", pt: "Nenhuma sessão concluída ainda.", es: "Aún no hay sesiones completadas." },
  weekly_growth: { en: "Weekly growth", pt: "Evolução semanal", es: "Crecimiento semanal" },
  questions: { en: "Questions", pt: "Questões", es: "Preguntas" },
  accuracy: { en: "Accuracy", pt: "Precisão", es: "Precisión" },
  study_time: { en: "Study time", pt: "Tempo de estudo", es: "Tiempo de estudio" },
  flags: { en: "Flags", pt: "Marcadas", es: "Marcadas" },
  next_action: { en: "Next action", pt: "Próxima ação", es: "Siguiente acción" },
  review_queue: { en: "Review queue", pt: "Fila de revisão", es: "Cola de revisión" },
  starting_session: { en: "Starting...", pt: "Iniciando...", es: "Iniciando..." },
  start_now: { en: "Start now", pt: "Começar agora", es: "Empezar ahora" },
  next_block: { en: "Next block", pt: "Próximo bloco", es: "Siguiente bloque" },
  active_now: { en: "Active now", pt: "Ativo agora", es: "Activo ahora" },
  active_week: { en: "Active week", pt: "Semana ativa", es: "Semana activa" },
  start_today: { en: "Start today", pt: "Comece hoje", es: "Empieza hoy" },

  // Flashcards
  flashcards_hero_tag: { en: "USMLE 2026 Active Recall", pt: "Repetição Espaçada USMLE 2026", es: "Repetición Espaciada USMLE 2026" },
  flashcards_hero_title: { en: "Flashcards for Rapid USMLE Recall", pt: "Flashcards para Memorização Rápida USMLE", es: "Fichas para Memorización Rápida USMLE" },
  flashcards_hero_subtitle: { en: "Active-recall study decks for Step 1, Step 2 CK, Pharmacology, Cardiology, and the new 2026 Nutrition Science standard.", pt: "Decks de estudo ativo para Step 1, Step 2 CK, Farmacologia, Cardiologia e a nova diretriz de Nutrição 2026.", es: "Mazos de estudio activo para Step 1, Step 2 CK, Farmacología, Cardiología y la nueva norma de Nutrición 2026." },
  all_subjects: { en: "All Subjects", pt: "Todas as matérias", es: "Todas las materias" },
  start_rapid_review: { en: "▶ Start Rapid Review", pt: "▶ Iniciar Revisão Rápida", es: "▶ Iniciar Revisión Rápida" },
  back_to_study: { en: "Back to Study", pt: "Voltar para Estudos", es: "Volver a Estudio" },
  available_decks: { en: "Available Decks", pt: "Decks Disponíveis", es: "Mazos Disponibles" },
  cards_count: { en: "cards", pt: "cartões", es: "fichas" },
  start_deck: { en: "Start Deck →", pt: "Iniciar Deck →", es: "Iniciar Mazo →" },

  // Flashcard Deck Translations
  deck_starter_title: { en: "USMLE Rapid Recall Starter", pt: "Iniciante de Memorização Rápida USMLE", es: "Iniciador de Memorización Rápida USMLE" },
  deck_starter_desc: { en: "High-yield core concepts across Step 1, Step 2, and Step 3.", pt: "Conceitos fundamentais de alto rendimento para Step 1, Step 2 e Step 3.", es: "Conceptos fundamentales de alto rendimiento para Step 1, Step 2 y Step 3." },
  deck_cardio_title: { en: "Cardiology & Vascular Medicine", pt: "Cardiologia e Medicina Vascular", es: "Cardiología y Medicina Vascular" },
  deck_cardio_desc: { en: "Murmurs, antiarrhythmics, heart failure, and EKG pearls.", pt: "Sopros, antiarrítmicos, insuficiência cardíaca e ECG.", es: "Soplos, antiarrítmicos, insuficiencia cardíaca y ECG." },
  deck_pharm_title: { en: "Pharmacology Antidotes & Tox", pt: "Farmacologia: Antídotos e Toxicologia", es: "Farmacología: Antídotos y Toxicología" },
  deck_pharm_desc: { en: "Essential antidotes, toxicities, and mechanism of actions.", pt: "Antídotos essenciais, toxicidade e mecanismos de ação.", es: "Antídotos esenciales, toxicidades y mecanismos de acción." },
  deck_nutrition_title: { en: "USMLE 2026 Nutrition Science", pt: "Ciência da Nutrição USMLE 2026", es: "Ciencia de la Nutrición USMLE 2026" },
  deck_nutrition_desc: { en: "Vitamin deficiencies, metabolic pathways, and dietetics.", pt: "Deficiências vitamínicas, vias metabólicas e dietética.", es: "Deficiencias vitamínicas, vías metabólicas y dietética." },
  deck_endocrine_title: { en: "Endocrine & Metabolic Disorders", pt: "Distúrbios Endócrinos e Metabólicos", es: "Trastornos Endocrinos y Metabólicos" },
  deck_endocrine_desc: { en: "Adrenal, thyroid, pituitary, and diabetes high-yield cards.", pt: "Cartões de alto rendimento sobre adrenal, tireoide, hipófise e diabetes.", es: "Fichas de alto rendimiento sobre adrenal, tiroides, hipófisis y diabetes." },

  // Flashcard Session Player
  quick_recall_session: { en: "Quick recall session", pt: "Sessão de memorização rápida", es: "Sesión de memorización rápida" },
  think_first_tap: { en: "Think first. Tap the card or press Space to reveal.", pt: "Pense primeiro. Toque no cartão ou pressione Espaço para revelar.", es: "Piensa primero. Toca la ficha o presiona Espacio para revelar." },
  session_complete: { en: "Session complete", pt: "Sessão concluída", es: "Sesión completada" },
  restart_session: { en: "Restart session", pt: "Reiniciar sessão", es: "Reiniciar sesión" },
  tap_to_reveal: { en: "Tap to reveal answer", pt: "Toque para ver a resposta", es: "Toca para ver la respuesta" },
  how_well_remember: { en: "How well did you remember it?", pt: "Com qual facilidade você se lembrou?", es: "¿Qué tan bien lo recordaste?" },
  reveal_before_rating: { en: "Reveal the answer before rating.", pt: "Revele a resposta antes de classificar.", es: "Revela la respuesta antes de calificar." },
  rating_again: { en: "Again", pt: "Repetir", es: "Repetir" },
  rating_hard: { en: "Hard", pt: "Difícil", es: "Difícil" },
  rating_good: { en: "Good", pt: "Bom", es: "Bueno" },
  rating_easy: { en: "Easy", pt: "Fácil", es: "Fácil" },
  clinical_pearl: { en: "Clinical pearl:", pt: "Pérola clínica:", es: "Perla clínica:" },
  question_label: { en: "Question", pt: "Pergunta", es: "Pregunta" },
  answer_label: { en: "Answer", pt: "Resposta", es: "Respuesta" },
  starter_ui_scaffold: { en: "Starter session completed successfully.", pt: "Sessão inicial concluída com sucesso.", es: "Sesión inicial completada con éxito." },
  unable_load_flashcards: { en: "Unable to load flashcards", pt: "Não foi possível carregar os flashcards", es: "No se pudieron cargar las fichas" },
  block_complete: { en: "block complete", pt: "bloco concluído", es: "bloque completado" },
  resume_active_block_momentum: { en: "Resume your active block to keep momentum.", pt: "Retome seu bloco ativo para manter o ritmo.", es: "Reanuda tu bloque activo para mantener el ritmo." },
  block_complete_extend: { en: "Block complete. Start another block to extend momentum.", pt: "Bloco concluído. Inicie outro bloco para manter o ritmo.", es: "Bloque completado. Inicia otro bloque para continuar el ritmo." },
  questions_to_next_level: { en: "questions to next level.", pt: "questões para o próximo nível.", es: "preguntas para el siguiente nivel." },
  review_flags: { en: "Review flags", pt: "Revisar marcadas", es: "Revisar marcadas" },
  prioritize_flagged_hint: { en: "Use Progress to prioritize flagged questions.", pt: "Use o Progresso para priorizar questões marcadas.", es: "Usa Progreso para priorizar preguntas marcadas." },
  loading_account: { en: "Loading your account...", pt: "Carregando sua conta...", es: "Cargando su cuenta..." },
  sign_in_to_study: { en: "Sign in to study", pt: "Faça login para estudar", es: "Inicia sesión para estudiar" },
  sign_in_required_desc: { en: "You need to be signed in to create or resume sessions.", pt: "Você precisa estar conectado para criar ou retomar sessões.", es: "Debes iniciar sesión para crear o reanudar sesiones." },
  error_label: { en: "Error", pt: "Erro", es: "Error" },
  refresh_sessions: { en: "Refresh sessions", pt: "Atualizar sessões", es: "Actualizar sesiones" },
  refreshing_label: { en: "Refreshing...", pt: "Atualizando...", es: "Actualizando..." },
  temp_connection_failure: { en: "Temporary connection failure. Click to refresh.", pt: "Falha temporária de conexão. Clique em recarregar.", es: "Fallo temporal de conexión. Haz clic para recargar." },

  // Results Page
  results_title: { en: "Results", pt: "Resultados", es: "Resultados" },
  results_desc: { en: "Browse your study history, revisit completed sessions, and resume unfinished ones.", pt: "Consulte seu histórico de estudos, revise sessões concluídas e retome blocos pendentes.", es: "Examina tu historial de estudio, revisa sesiones completadas y reanuda las pendientes." },
  sign_in_view_results: { en: "Sign in to view your results", pt: "Faça login para ver seus resultados", es: "Inicia sesión para ver tus resultados" },
  completed_stat: { en: "Completed", pt: "Concluídas", es: "Completadas" },
  in_progress_stat: { en: "In progress", pt: "Em andamento", es: "En progreso" },
  abandoned_stat: { en: "Abandoned", pt: "Abandonadas", es: "Abandonadas" },
  quick_actions: { en: "Quick actions", pt: "Ações rápidas", es: "Acciones rápidas" },
  refresh_button: { en: "Refresh", pt: "Atualizar", es: "Actualizar" },
  resume_latest_open: { en: "Resume latest open session", pt: "Retomar última sessão aberta", es: "Reanudar última sesión abierta" },
  start_new_session: { en: "Start a new study session", pt: "Iniciar nova sessão de estudo", es: "Iniciar nova sessão de estudo" },
  open_latest_review: { en: "Open latest completed review", pt: "Abrir revisão da última concluída", es: "Abrir revisión de la última completada" },
  open_progress_action: { en: "Open Progress", pt: "Abrir Progresso", es: "Abrir Progreso" },
  filters_title: { en: "Filters", pt: "Filtros", es: "Filtros" },
  all_modes: { en: "All modes", pt: "Todos os modos", es: "Todos los modos" },
  all_statuses: { en: "All statuses", pt: "Todos os status", es: "Todos los estados" },
  session_history: { en: "Session history", pt: "Histórico de sessões", es: "Historial de sesiones" },
  turn_results_into_block: { en: "Turn every result into the next block", pt: "Transforme cada resultado no seu próximo bloco", es: "Convierte cada resultado en el siguiente bloque" },
  continue_studying_btn: { en: "Continue studying", pt: "Continuar estudando", es: "Continuar estudiando" },

  // Progress Page
  progress_title: { en: "Progress", pt: "Progresso", es: "Progreso" },
  progress_desc: { en: "Track study activity, completion patterns, mode distribution, and engagement signals.", pt: "Acompanhe sua atividade, taxa de conclusão, distribuição de modos e engajamento.", es: "Sigue tu actividad de estudio, patrones de finalización, distribución de modos y nivel de participación." },
  sign_in_view_progress: { en: "Sign in to view progress", pt: "Faça login para ver seu progresso", es: "Inicia sesión para ver tu progreso" },
  activity_heatmap: { en: "Activity heatmap", pt: "Gráfico de atividade", es: "Gráfico de actividad" },
  block_analytics: { en: "Block analytics", pt: "Análise por blocos", es: "Análisis por bloques" },
  weakest_block: { en: "Weakest block", pt: "Bloco com menor desempenho", es: "Bloque con menor rendimiento" },
  most_flagged_block: { en: "Most flagged block", pt: "Bloco com mais marcações", es: "Bloque con más marcadas" },

  // Settings Page
  settings_title: { en: "Settings", pt: "Configurações", es: "Configuración" },
  settings_desc: { en: "Personalize your study defaults, official-format timing, and question filters.", pt: "Personalize seus padrões de estudo, tempo oficial e filtros de questões.", es: "Personaliza tus ajustes predeterminados, tiempos oficiales y filtros de preguntas." },
  reset_defaults: { en: "Reset defaults", pt: "Restaurar padrões", es: "Restablecer valores predeterminados" },
  local_settings: { en: "Local settings", pt: "Configurações locais", es: "Configuración local" },
  sign_in_use_settings: { en: "Sign in to use settings", pt: "Faça login para acessar as configurações", es: "Inicia sesión para usar la configuración" },
  account_section: { en: "Account", pt: "Conta", es: "Cuenta" },
  name_label: { en: "Name", pt: "Nome", es: "Nombre" },
  email_label: { en: "Email", pt: "E-mail", es: "Correo electrónico" },
  study_defaults_section: { en: "Study defaults", pt: "Padrões de estudo", es: "Ajustes predeterminados de estudio" },
  default_exam: { en: "Default exam", pt: "Exame padrão", es: "Examen predeterminado" },
  default_mode: { en: "Default mode", pt: "Modo padrão", es: "Modo predeterminado" },
  official_2026_format: { en: "Official 2026 exam format", pt: "Formato oficial do exame 2026", es: "Formato oficial del examen 2026" },
  excluded_medical_areas: { en: "Excluded Medical Areas", pt: "Áreas médicas excluídas", es: "Áreas médicas excluidas" },
  include_all: { en: "Include all", pt: "Incluir todas", es: "Incluir todas" },
  questions_per_practice: { en: "Questions per practice session", pt: "Questões por sessão de prática", es: "Preguntas por sesión de práctica" },
  review_options: { en: "Review options", pt: "Opções de revisão", es: "Opciones de revisión" },
  auto_open_review: { en: "Auto-open review after submit", pt: "Abrir revisão automaticamente após enviar", es: "Abrir revisión automáticamente al enviar" },
  confirm_before_leaving: { en: "Confirm before leaving active session", pt: "Confirmar antes de sair de uma sessão ativa", es: "Confirmar antes de salir de una sesión activa" },
  emphasize_timer: { en: "Emphasize timer in timed mode", pt: "Destacar cronômetro no modo temporizado", es: "Destacar temporizador en modo con tiempo" },

  // Break Timer Modal
  official_break_title: { en: "USMLE 2026 Official Break", pt: "Pausa Oficial USMLE 2026", es: "Pausa Oficial USMLE 2026" },
  cumulative_break_time: { en: "Cumulative Break Time", pt: "Tempo Acumulado de Pausa", es: "Tiempo Acumulado de Pausa" },
  track_break_pool: { en: "Track your official 55-minute break pool between 20-question exam blocks.", pt: "Acompanhe seu banco oficial de 55 minutos de pausa entre os blocos.", es: "Controla tu bolsa oficial de 55 minutos de descanso entre bloques de examen." },
  start_break: { en: "▶ Start Break", pt: "▶ Iniciar Pausa", es: "▶ Iniciar Pausa" },
  pause_break: { en: "⏸ Pause Break", pt: "⏸ Pausar Pausa", es: "⏸ Pausar Pausa" },
  finish_break: { en: "✓ Finish Break & Start Next Block", pt: "✓ Finalizar Pausa e Iniciar Próximo Bloco", es: "✓ Finalizar Pausa e Iniciar Siguiente Bloque" },
  close_button: { en: "Close", pt: "Fechar", es: "Cerrar" },
  minutes_used_of: { en: "minutes used of 55 minutes total", pt: "minutos utilizados de 55 minutos no total", es: "minutos usados de 55 minutos en total" },

  // Score Logger Modal
  readiness_predictor: { en: "USMLE Readiness Predictor", pt: "Preditor de Aprovação USMLE", es: "Predictor de Aprobación USMLE" },
  log_external_exam: { en: "Log External Practice Exam", pt: "Registrar Simulado Externo", es: "Registrar Examen de Práctica" },
  enter_nbme_score: { en: "Enter your NBME Form or Free 120 score to estimate your official Pass Probability.", pt: "Informe seu resultado no NBME ou Free 120 para estimar a probabilidade de aprovação.", es: "Ingresa tu puntuación de NBME o Free 120 para estimar tu probabilidad de aprobación." },
  select_exam: { en: "Select Exam / Practice Test", pt: "Selecionar Exame / Simulado", es: "Seleccionar Examen / Prueba" },
  correct_percentage: { en: "Correct Answers Percentage (%)", pt: "Porcentagem de Acertos (%)", es: "Porcentaje de Aciertos (%)" },
  estimated_pass_prob: { en: "Estimated USMLE Pass Probability", pt: "Probabilidade Estimada de Aprovação", es: "Probabilidad Estimada de Aprobación" },
  based_on_correlation: { en: "Based on official NBME & Free 120 correlation data.", pt: "Baseado em dados oficiais de correlação NBME e Free 120.", es: "Basado en datos oficiales de correlación NBME y Free 120." },
  save_exam_score: { en: "✓ Save Exam Score", pt: "✓ Salvar Nota do Simulado", es: "✓ Guardar Nota del Examen" },
  cancel_button: { en: "Cancel", pt: "Cancelar", es: "Cancelar" },
};

type LanguageContextType = {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  t: (key: string) => string;
};

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: (key: string) => key,
});

const STORAGE_KEY = "usmle_selected_language";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>("en");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as SupportedLanguage | null;
      if (saved && ["en", "pt", "es"].includes(saved)) {
        setLanguageState(saved);
      }
    } catch {
      // Ignore local storage errors
    }
  }, []);

  function setLanguage(lang: SupportedLanguage) {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Ignore
    }
  }

  function t(key: string): string {
    if (translations[key] && translations[key][language]) {
      return translations[key][language];
    }
    return key;
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
