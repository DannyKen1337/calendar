"use client";
import { useState, useEffect } from "react";
import { message, Form, Modal } from "antd";
import { getGameColor } from "@/lib/gameConfig";
import { resolveAttendance } from "@/lib/attendance";
import { canManageEvent, canManageCategory } from "@/lib/permissions";
import { sanitizeEventType, getEventType } from "@/lib/eventTypes";
import { findHostConflicts } from "@/lib/hostConflicts";
import { getOpeningHoursWarning } from "@/lib/storeHours";

export const useCalendar = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState(null);
  const [allowedCategories, setAllowedCategories] = useState(null); // null = minden játék (lásd lib/permissions.js)
  const [lastSeenChangelog, setLastSeenChangelog] = useState(null); // az utoljára elolvasott újdonság (lib/changelog.js)
  const [usersList, setUsersList] = useState([]);
  const [staffList, setStaffList] = useState([]); // adminok és tulajdonosok: az esemény szervezőjének választhatók
  
  // A legutóbb választott helyszín. Szerveren null – ez nem okoz hidratálási eltérést, mert betöltés közben a helyszínt még semmi nem jeleníti meg.
  // Beágyazott (harmadik féltől származó) iframe-ben a böngésző letilthatja a localStorage-ot: ilyenkor kivételt dob
  const [selectedStore, setSelectedStore] = useState(() => {
    try { return typeof window !== 'undefined' ? localStorage.getItem('tavern_selected_store') : null; } catch { return null; }
  });
  
  const [logs, setLogs] = useState([]);
  const [blacklist, setBlacklist] = useState([]);
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isBlacklistModalOpen, setIsBlacklistModalOpen] = useState(false);

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isEventModalOpen, setIsEventModalOpen] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [isExternalForm, setIsExternalForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState(null);
  const [isCopyingEvent, setIsCopyingEvent] = useState(false); // az űrlap egy meglévő esemény másolatát tartalmazza
  const [isUploading, setIsUploading] = useState(false);
  
  const [isEventDetailsModalOpen, setIsEventDetailsModalOpen] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState(null);
  
  const [selectedEventToJoin, setSelectedEventToJoin] = useState(null);
  const [isUnsubscribeModalOpen, setIsUnsubscribeModalOpen] = useState(false);
  
  const [isAttendeesModalOpen, setIsAttendeesModalOpen] = useState(false);
  const [selectedEventIdForAttendees, setSelectedEventIdForAttendees] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState({}); // e-mail => { attended, noShow }

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState(null);
  const [isOwnPasswordModalOpen, setIsOwnPasswordModalOpen] = useState(false);
  const [canRegister, setCanRegister] = useState(false);
  const [isCreateUserModalOpen, setIsCreateUserModalOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [togglingGateId, setTogglingGateId] = useState(null);
  const [isUnsubscribing, setIsUnsubscribing] = useState(false);
  
  const [passwordForm] = Form.useForm();
  const [ownPasswordForm] = Form.useForm();
  const [eventForm] = Form.useForm();
  const [unsubscribeForm] = Form.useForm();
  const [authForm] = Form.useForm();
  const [blacklistForm] = Form.useForm();
  const [createUserForm] = Form.useForm();
  const [messageApi, messageHolder] = message.useMessage();
  const [modalApi, modalHolder] = Modal.useModal();
  const contextHolder = <>{messageHolder}{modalHolder}</>;

  // Munkamenet betöltése: bejelentkezve az admin, egyébként a nyilvános adatok töltődnek be.
  // Promise-lánc (nem async/await), hogy indításkor az effektből hívva se tűnjön szinkron állapotállításnak.
  const checkSession = () => fetch('/api/auth/session')
    .then((res) => res.json())
    .then((data) => {
      if (data.user) {
        setUserName(data.user.username);
        setUserId(data.user.id ? String(data.user.id) : null);
        setUserEmail(data.user.email);
        setUserRole(data.user.role);
        setAllowedCategories(Array.isArray(data.user.allowedCategories) ? data.user.allowedCategories : null);
        setLastSeenChangelog(data.user.lastSeenChangelog || null);
        fetchAdminData(false); 
      } else {
        fetchPublicData(false);
      }
    })
    .catch(() => fetchPublicData(false));

  const handleSelectStore = (storeId) => {
    setSelectedStore(storeId);
    try {
      if (storeId) localStorage.setItem('tavern_selected_store', storeId);
      else localStorage.removeItem('tavern_selected_store');
    } catch {}
  };

  const fetchPublicData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const response = await fetch(`/api/public-data?t=${Date.now()}`);
      const data = await response.json();
      if (data.tournaments) {
        const coloredTournaments = data.tournaments.map(t => ({
          ...t,
          color: getGameColor(t)
        }));
        setTournaments(coloredTournaments);
      }
      if (typeof data.isMaintenance !== 'undefined') setIsMaintenance(data.isMaintenance);
      if (data.error) messageApi.error('Nem sikerült betölteni az eseményeket.');
    } catch {
      messageApi.error('Hálózati hiba az események betöltésekor.');
    }
    if (!isBackground) setLoading(false);
  };

  const fetchAdminData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const response = await fetch(`/api/admin-data?t=${Date.now()}`);
      if (response.status === 401) {
         setUserRole(null);
         fetchPublicData(isBackground);
         return;
      }
      const data = await response.json();
      if (data.tournaments) {
        const coloredTournaments = data.tournaments.map(t => ({
          ...t,
          color: getGameColor(t)
        }));
        setTournaments(coloredTournaments);
      }
      if (data.registrations) setRegistrations(data.registrations);
      if (data.attendanceStats) setAttendanceStats(data.attendanceStats);
      if (data.users) setUsersList(data.users);
      if (data.staff) setStaffList(data.staff);
      if (data.logs) setLogs(data.logs);
      if (data.blacklist) setBlacklist(data.blacklist);
      if (typeof data.isMaintenance !== 'undefined') setIsMaintenance(data.isMaintenance);
      if (data.error) messageApi.error(data.error);
    } catch {
      messageApi.error('Hálózati hiba az admin adatok betöltésekor.');
      fetchPublicData(isBackground);
    }
    if (!isBackground) setLoading(false);
  };

  // Indításkor: munkamenet és adatok betöltése (a függvények után, hogy deklarálva legyenek)
  useEffect(() => {
    checkSession();
    fetch('/api/auth')
      .then((res) => res.json())
      .then((data) => setCanRegister(!!data.canRegister))
      .catch(() => setCanRegister(false));
  }, []);

  const fetchData = (isBackground = false) => {
    if (userRole === 'admin' || userRole === 'owner') {
      return fetchAdminData(isBackground);
    }
    return fetchPublicData(isBackground);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUserRole(null); setUserName(""); setUserEmail(""); setUserId(null); setAllowedCategories(null);
    fetchPublicData(false);
  };

  const handleAuthSubmit = async (values) => {
    const action = isRegistering ? 'register' : 'login';
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...values }) });
      const data = await response.json();
      if (data.error) messageApi.error(data.error);
      else if (action === 'login' && data.mustChangePassword) {
        messageApi.info('Első belépés: az ideiglenes jelszó lecseréléséhez használd az /admin oldalt.');
      } else if (action === 'login') {
        messageApi.success(`Üdvözlünk, ${data.user.username}!`);
        setIsAuthModalOpen(false); authForm.resetFields();
        checkSession(); // a játék-jogosultságokat is betölti
      } else {
        messageApi.success('Sikeres regisztráció! Most jelentkezz be.');
        setIsRegistering(false);
        authForm.resetFields();
      }
    } catch { messageApi.error("Szerver hiba történt."); }
  };

  // Admin művelet küldése; hiba esetén üzenetet mutat és null-t ad vissza, így sikert csak valódi siker után jelzünk
  const postAction = async (actionType, payload) => {
    try {
      const response = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType, payload }) });
      let result = null;
      try { result = await response.json(); } catch { result = null; }
      if (!response.ok || !result || result.error) {
        messageApi.error((result && result.error) || 'A művelet nem sikerült.');
        return null;
      }
      return result;
    } catch {
      messageApi.error('Hálózati hiba történt.');
      return null;
    }
  };

  const toggleMaintenance = async (newState) => {
    if (!(await postAction('TOGGLE_MAINTENANCE', { isMaintenance: newState }))) return;
    setIsMaintenance(newState); messageApi.success(newState ? "Karbantartás BEKAPCSOLVA." : "Karbantartás KIKAPCSOLVA."); fetchData(true);
  };

  const handleBanEmail = async (values) => {
    if (!(await postAction('BAN_EMAIL', { email: values.email, reason: values.reason }))) return;
    messageApi.success("E-mail cím feketelistára téve."); blacklistForm.resetFields(); fetchData(true);
  };

  const handleUnbanEmail = async (email) => {
    if (!(await postAction('UNBAN_EMAIL', { email }))) return;
    messageApi.success("Tiltás feloldva."); fetchData(true);
  };

  const handleExportDB = () => window.location.href = '/api/export-db';

  const handleCleanupOldEvents = async () => {
    try {
      const response = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'CLEANUP_OLD_EVENTS', payload: {} }) });
      const result = await response.json();
      if (result.error) messageApi.error(result.error);
      else { messageApi.success(`${result.count} db régi esemény törölve!`); fetchData(true); }
    } catch { messageApi.error("Hálózati hiba történt."); }
  };

  const toggleUserRole = async (targetUser) => {
    const makeAdmin = targetUser.role !== 'admin';
    const targetId = String(targetUser._id || targetUser.id);
    if (!(await postAction('TOGGLE_ROLE', { targetUserId: targetId, makeAdmin }))) return;
    fetchData(true);
  };

  const initiatePasswordChange = (user) => { setSelectedUserForPassword(user); passwordForm.resetFields(); setIsPasswordModalOpen(true); };
  
  const submitPasswordChange = async (values) => {
    const uId = String(selectedUserForPassword._id || selectedUserForPassword.id);
    try {
      const response = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'CHANGE_USER_PASSWORD', payload: { userId: uId, newPassword: values.newPassword } }) });
      const result = await response.json();
      if (result.error) { messageApi.error(result.error); return; }
      messageApi.success("Jelszó sikeresen felülírva!"); setIsPasswordModalOpen(false);
    } catch { messageApi.error("Hálózati hiba történt."); }
  };

  const submitOwnPasswordChange = async (values) => {
    try {
      const response = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: 'CHANGE_OWN_PASSWORD',
          payload: { currentPassword: values.currentPassword, newPassword: values.newPassword },
        }),
      });
      const result = await response.json();
      if (result.error) { messageApi.error(result.error); return; }
      messageApi.success("Saját jelszavad sikeresen megváltozott!");
      setIsOwnPasswordModalOpen(false);
      ownPasswordForm.resetFields();
    } catch { messageApi.error("Hálózati hiba történt."); }
  };

  const handleDeleteUser = async (userId) => {
    if (!(await postAction('DELETE_USER', { userId: String(userId) }))) return;
    messageApi.success("Felhasználó törölve."); fetchData(true);
  };

  const handleImageUpload = async (info, targetForm) => {
    const file = info.file.originFileObj || info.file; if (!file) return;
    setIsUploading(true);
    const formData = new FormData(); formData.append('image', file);
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) { targetForm.setFieldsValue({ imageUrl: data.url }); messageApi.success('Kép feltöltve!'); } 
      else { messageApi.error(`Hiba: ${data.error}`); }
    } catch { messageApi.error('Hálózati hiba a feltöltésnél.'); }
    setIsUploading(false);
  };

  const saveEvent = async (values) => {
    const formValues = values || eventForm.getFieldsValue();
    // Az űrlapon nem szereplő mezők (kép, egyedi szín) szerkesztéskor a meglévő eseményből maradnak meg
    const existing = editingEventId ? tournaments.find(t => String(t._id || t.id) === String(editingEventId)) : null;
    try {
      const eventColor = getGameColor({
        category: formValues.category,
        name: formValues.name,
        game: formValues.game,
        color: formValues.category === 'Egyéb' ? (formValues.color ?? existing?.color) : undefined,
      });

      const { isOpenAttendance, max_players: resolvedMaxPlayers } = resolveAttendance(formValues.max_players, formValues.isOpenAttendance);
      const payload = { 
        ...formValues, 
        max_players: resolvedMaxPlayers, 
        external_url: isOpenAttendance ? "" : (formValues.external_url || ""), 
        imageUrl: formValues.imageUrl || existing?.imageUrl || "",
        isExternalEvent: isOpenAttendance ? false : !!formValues.external_url,
        isOpenAttendance,
        isFeatured: !!formValues.isFeatured,
        eventType: sanitizeEventType(formValues.eventType),
        hosts: Array.isArray(formValues.hosts) ? formValues.hosts : [],
        color: eventColor 
      };
      
      // Mentés előtti figyelmeztetések (a mentést nem tiltják, csak rákérdezünk):
      // - nyitvatartás: nyitás előtt / nyitás után 30 percen belül / zárás után / zárva tartó napon kezdődik.
      //   Szerkesztéskor csak akkor, ha az időpont vagy a helyszín változott, hogy a régi eseményeknél ne zavarjon.
      // - szervezői ütközés: ugyanaz a szervező egy időben másik eseményt is tart
      const timeChanged = !existing || existing.date !== payload.date || (existing.store || 'debrecen') !== (payload.store || 'debrecen');
      const hoursWarning = timeChanged ? getOpeningHoursWarning(payload.store, payload.date) : null;
      const conflicts = findHostConflicts(tournaments, { id: editingEventId, date: payload.date, hosts: payload.hosts });
      if (hoursWarning || conflicts.length > 0) {
        const confirmed = await modalApi.confirm({
          title: hoursWarning && conflicts.length > 0 ? 'Figyelmeztetések' : hoursWarning ? 'Nyitvatartáson kívüli időpont' : 'Szervezői ütközés',
          content: (
            <div>
              {hoursWarning && <p>{hoursWarning}</p>}
              {conflicts.length > 0 && (
                <>
                  <p>Szervezői ütközés, ebben az időpontban már másik eseményt is tart:</p>
                  <ul style={{ paddingLeft: 18 }}>
                    {conflicts.map(({ hostId, event }) => (
                      <li key={`${hostId}-${event._id || event.id}`}><b>{staffList.find(u => u.id === hostId)?.username || 'Ismeretlen'}</b>: {event.name} ({formatEventDate(event.date)})</li>
                    ))}
                  </ul>
                </>
              )}
              <p>Mégis mented?</p>
            </div>
          ),
          okText: 'Mentés így is',
          cancelText: 'Vissza',
          okButtonProps: { style: { color: '#000', fontWeight: 'bold' } },
        });
        if (!confirmed) return;
      }

      const actionType = editingEventId ? 'EDIT_TOURNAMENT' : 'ADD_TOURNAMENT';
      const actionPayload = editingEventId ? { id: editingEventId, ...payload } : payload;
      const response = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType, payload: actionPayload }),
      });
      const result = await response.json();
      if (result.error || !response.ok) {
        messageApi.error(result.error || 'Mentés sikertelen.');
        return;
      }
      messageApi.success(editingEventId ? 'Frissítve!' : 'Létrehozva!');
      
      setIsEventModalOpen(false); eventForm.resetFields(); setEditingEventId(null); setIsExternalForm(false); 
      fetchData(true); 
    } catch {
      messageApi.error('Nem sikerült menteni az eseményt.');
    }
  };

  // Az űrlap mezői egy meglévő eseményből (szerkesztéshez és másoláshoz)
  const eventFormValues = (evt) => ({
    name: evt.name, store: evt.store || 'debrecen', category: evt.category, date: evt.date,
    max_players: evt.isOpenAttendance ? undefined : (evt.max_players || 8), external_url: evt.external_url || '', description: evt.description || '',
    isFeatured: !!evt.isFeatured, isOpenAttendance: !!evt.isOpenAttendance, eventType: getEventType(evt),
    hosts: (evt.hosts || []).map(String).filter(id => eligibleHosts(evt.category).some(u => u.id === id)),
  });

  const openEditEvent = (evt) => {
    eventForm.resetFields();
    eventForm.setFieldsValue(eventFormValues(evt));
    setEditingEventId(String(evt._id || evt.id)); setIsCopyingEvent(false); setIsExternalForm(!!evt.external_url); setIsEventModalOpen(true);
  };

  // Másolás: ugyanazokkal az adatokkal új esemény, csak az időpontot kell megadni
  const openCopyEvent = (evt) => {
    eventForm.resetFields();
    eventForm.setFieldsValue({ ...eventFormValues(evt), date: undefined });
    setEditingEventId(null); setIsCopyingEvent(true); setIsExternalForm(!!evt.external_url); setIsEventModalOpen(true);
  };

  const handleDeleteTournament = async (tournamentId) => { 
     if (!(await postAction('DELETE_TOURNAMENT', { tournamentId: String(tournamentId), id: String(tournamentId) }))) return;
     messageApi.success("Esemény törölve."); 
     fetchData(true); 
   };

  const initiateJoin = (tournament) => {
    setIsEventDetailsModalOpen(false);
    if (tournament.isOpenAttendance) return; // kötetlen létszámú eseményre nincs jelentkezés
    if (tournament.external_url) { window.open(tournament.external_url, '_blank', 'noopener,noreferrer'); return; }
    // Jelentkezés külön, játékhoz tematikus oldalon. Beágyazva (webshop iframe) az iframe-en belül nyílik meg, kompakt nézetben.
    const embedded = document.documentElement.classList.contains('tavern-embed');
    window.location.href = `/jelentkezes/${encodeURIComponent(String(tournament._id || tournament.id))}${embedded ? '?embed=1' : ''}`;
  };

  const initiateUnsubscribe = (tournament) => {
    setIsEventDetailsModalOpen(false); setSelectedEventToJoin(tournament); unsubscribeForm.resetFields();
    if (userEmail) unsubscribeForm.setFieldsValue({ email: userEmail });
    setIsUnsubscribeModalOpen(true);
  };

  const submitUnsubscribe = async (values) => {
    if (isUnsubscribing || !selectedEventToJoin) return; // dupla kattintás ellen
    const eId = String(selectedEventToJoin._id || selectedEventToJoin.id);
    const email = String(values.email || '').trim().toLowerCase();
    setIsUnsubscribing(true);
    try {
      const response = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'UNSUBSCRIBE_BY_EMAIL', payload: { tournamentId: eId, email } }) });
      let result = null;
      try { result = await response.json(); } catch { result = null; }
      if (!response.ok || !result || result.error) { messageApi.error((result && result.error) || 'A leiratkozás most nem sikerült. Kérlek próbáld újra.'); return; }
      if (result.emailSent) messageApi.success({ content: "Ha erről a címről van jelentkezés, elküldtük e-mailben a leiratkozó linket. Nézd meg a postafiókod (a spam mappát is)!", duration: 8 });
      else messageApi.success("Sikeresen lejelentkeztél az eseményről.");
      setIsUnsubscribeModalOpen(false); unsubscribeForm.resetFields();
      fetchData(true);
    } catch { messageApi.error("Hálózati hiba történt."); }
    finally { setIsUnsubscribing(false); }
  };

  // Versenyző hozzáadása az admin által (helyszíni / telefonos jelentkezés). Sikerkor true.
  const adminAddRegistration = async (tournamentId, values) => {
    const result = await postAction('ADMIN_ADD_REGISTRATION', { tournamentId: String(tournamentId), ...values });
    if (!result) return false;
    messageApi.success(result.isQueue ? 'Versenyző hozzáadva a várólistához.' : 'Versenyző hozzáadva.');
    fetchData(true);
    return true;
  };

  // Check-in: azonnal (optimistán) jelöljük, hiba esetén visszaállítjuk; utána frissítjük a statisztikát
  const setAttendance = async (registrationId, attended) => {
    const id = String(registrationId);
    const prev = registrations.find(r => String(r._id || r.id) === id)?.attended;
    const apply = (value) => setRegistrations(list => list.map(r => String(r._id || r.id) === id ? { ...r, attended: value ?? undefined } : r));
    apply(attended);
    if (!(await postAction('SET_ATTENDANCE', { registrationId: id, attended }))) { apply(prev); return; }
    fetchData(true);
  };

  const handleRemoveRegistration = async (registrationId) => {
    if (!(await postAction('REMOVE_REGISTRATION', { registrationId }))) return;
    messageApi.success("Jelentkező törölve.");
    fetchData(true);
  };

  const handleToggleGate = async (tournamentId, newState) => {
    const id = String(tournamentId);
    if (togglingGateId === id) return; // dupla kattintás ellen
    const isTarget = (t) => String(t._id || t.id) === id;
    const setOpen = (value) => setTournaments(prev => prev.map(t => isTarget(t) ? { ...t, is_open: value } : t));
    setTogglingGateId(id);
    // Azonnali (optimista) frissítés: nincs teljes oldalas betöltés, a szűrők, a keresés és a görgetés megmarad
    setOpen(newState);
    try {
      const response = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'TOGGLE_GATE', payload: { tournamentId: id, newState } }) });
      const result = await response.json();
      if (result.error || !response.ok) {
        setOpen(!newState);
        messageApi.error(result.error || 'A művelet nem sikerült.');
      } else {
        messageApi.success(newState ? 'Jelentkezés megnyitva.' : 'Jelentkezés lezárva.');
        fetchData(true);
      }
    } catch {
      setOpen(!newState);
      messageApi.error('Hálózati hiba történt.');
    }
    setTogglingGateId(null);
  };

  const closeCreateUserModal = () => {
    setIsCreateUserModalOpen(false);
    setCreatedCredentials(null);
    createUserForm.resetFields();
  };

  const submitCreateUser = async (values) => {
    setIsCreatingUser(true);
    try {
      const response = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionType: 'CREATE_USER', payload: { username: values.username, email: values.email, role: values.role } }),
      });
      const result = await response.json();
      if (result.error || !response.ok) { messageApi.error(result.error || 'A felhasználó létrehozása sikertelen.'); }
      else {
        setCreatedCredentials({ username: result.username, email: result.email, tempPassword: result.tempPassword, expiresAt: result.expiresAt });
        messageApi.success('Felhasználó létrehozva!');
        fetchData(true);
      }
    } catch { messageApi.error('Hálózati hiba történt.'); }
    setIsCreatingUser(false);
  };

  // Játék-jogosultság a felületen (a szerver is ellenőrzi): a tulajdonos mindent, a korlátozott szervező csak a saját játékait kezelheti
  const currentUser = { role: userRole, allowedCategories };
  const canManage = (evt) => canManageEvent(currentUser, evt);
  const canManageGame = (category) => canManageCategory(currentUser, category);
  // Az esemény szervezőjének választható adminok: akik az adott játékot kezelhetik
  const eligibleHosts = (category) => staffList.filter(u => canManageCategory(u, category));
  // Az eseményt tartó szervezők neve (a közben törölt fiókok kimaradnak)
  const hostNames = (evt) => (Array.isArray(evt?.hosts) ? evt.hosts : []).map(id => staffList.find(u => u.id === String(id))?.username).filter(Boolean);

  // Újdonságok ablak bezárásakor: azonnal elrejtjük, és elmentjük, hogy ez a verzió már olvasott
  const markChangelogSeen = async (id) => {
    setLastSeenChangelog(id);
    await postAction('MARK_CHANGELOG_SEEN', { id });
  };

  const setAdminCategories = async (userId, categories) => {
    if (!(await postAction('SET_ADMIN_CATEGORIES', { userId: String(userId), categories }))) return false;
    messageApi.success('Jogosultság mentve.');
    fetchData(true);
    return true;
  };

  const formatEventDate = (dateString) => {
    if (!dateString) return "Hamarosan"; 
    const d = new Date(dateString); if (isNaN(d.getTime())) return dateString; 
    return (d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' })).replace(/^\w/, c => c.toUpperCase());
  };

  return {
    tournaments, setTournaments, loading, userRole, userName, userEmail, userId, usersList, staffList, openEditEvent, openCopyEvent,
    allowedCategories, canManage, canManageGame, eligibleHosts, hostNames, setAdminCategories, lastSeenChangelog, markChangelogSeen,
    selectedStore, handleSelectStore, 
    isMaintenance, toggleMaintenance, logs, isLogModalOpen, setIsLogModalOpen, blacklist, isBlacklistModalOpen, setIsBlacklistModalOpen, handleBanEmail, handleUnbanEmail, blacklistForm, handleExportDB, handleCleanupOldEvents,
    isAuthModalOpen, setIsAuthModalOpen, isRegistering, setIsRegistering, authForm, handleAuthSubmit, handleLogout, toggleUserRole,
    isPasswordModalOpen, setIsPasswordModalOpen, selectedUserForPassword, passwordForm, initiatePasswordChange, submitPasswordChange,
    isOwnPasswordModalOpen, setIsOwnPasswordModalOpen, ownPasswordForm, submitOwnPasswordChange, handleDeleteUser,
    isEventModalOpen, setIsEventModalOpen, isUsersModalOpen, setIsUsersModalOpen, isExternalForm, setIsExternalForm, editingEventId, setEditingEventId, isCopyingEvent, setIsCopyingEvent, eventForm, saveEvent, handleDeleteTournament,
    isUploading, handleImageUpload, isEventDetailsModalOpen, setIsEventDetailsModalOpen, selectedEventDetails, setSelectedEventDetails,
    selectedEventToJoin, initiateJoin,
    isUnsubscribeModalOpen, setIsUnsubscribeModalOpen, unsubscribeForm, initiateUnsubscribe, submitUnsubscribe, isUnsubscribing,
    isAttendeesModalOpen, setIsAttendeesModalOpen, selectedEventIdForAttendees, setSelectedEventIdForAttendees, registrations, handleRemoveRegistration, attendanceStats, setAttendance, adminAddRegistration,
    messageApi, contextHolder, formatEventDate, fetchData, canRegister, handleToggleGate, togglingGateId,
    isCreateUserModalOpen, setIsCreateUserModalOpen, createUserForm, createdCredentials, isCreatingUser, submitCreateUser, closeCreateUserModal
  };
};