"use client";
import { useState, useEffect } from "react";
import { message, Form } from "antd";

export const useCalendar = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false); 
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [usersList, setUsersList] = useState([]);
  
  const [selectedStore, setSelectedStore] = useState(null);
  
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
  const [isUploading, setIsUploading] = useState(false);
  
  const [isEventDetailsModalOpen, setIsEventDetailsModalOpen] = useState(false);
  const [selectedEventDetails, setSelectedEventDetails] = useState(null);
  
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [selectedEventToJoin, setSelectedEventToJoin] = useState(null);
  const [isUnsubscribeModalOpen, setIsUnsubscribeModalOpen] = useState(false);
  
  const [isAttendeesModalOpen, setIsAttendeesModalOpen] = useState(false);
  const [selectedEventIdForAttendees, setSelectedEventIdForAttendees] = useState(null);
  const [registrations, setRegistrations] = useState([]);

  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [selectedUserForPassword, setSelectedUserForPassword] = useState(null);
  
  const [passwordForm] = Form.useForm();
  const [eventForm] = Form.useForm();
  const [joinForm] = Form.useForm();
  const [unsubscribeForm] = Form.useForm();
  const [authForm] = Form.useForm();
  const [blacklistForm] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    checkSession();
    const storedStore = localStorage.getItem('tavern_selected_store');
    if (storedStore) setSelectedStore(storedStore);
  }, []);

  const checkSession = async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.user) {
        setUserName(data.user.username);
        setUserEmail(data.user.email);
        setUserRole(data.user.role);
        fetchAdminData(false); 
      } else {
        fetchPublicData(false);
      }
    } catch (e) {
      fetchPublicData(false);
    }
  };

  const handleSelectStore = (storeId) => {
    setSelectedStore(storeId);
    if (storeId) {
      localStorage.setItem('tavern_selected_store', storeId);
    } else {
      localStorage.removeItem('tavern_selected_store');
    }
  };

  // KIZÁRÓLAG A KATEGÓRIA ALAPJÁN ADJA A SZÍNT
  const getGameColor = (tournament) => {
    if (tournament.color && tournament.color !== '#E5B15D') {
      return tournament.color;
    }
    const text = `${tournament.game || ''} ${tournament.category || ''} ${tournament.name || ''}`.toLowerCase();
    
    if (text.includes('riftbound')) return '#8B5CF6'; 
    if (text.includes('pokemon') || text.includes('pokémon')) return '#F59E0B'; 
    if (text.includes('star wars') || text.includes('unlimited')) return '#EF4444'; 
    if (text.includes('lorcana')) return '#10B981'; 
    if (text.includes('magic') || text.includes('mtg')) return '#3B82F6'; 
    if (text.includes('flesh') || text.includes('blood') || text.includes('fab')) return '#B91C1C'; 
    if (text.includes('yu-gi-oh') || text.includes('yugioh')) return '#A855F7';
    if (text.includes('one piece')) return '#06B6D4';
    return '#E5B15D';
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
    } catch (e) {}
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
      if (data.users) setUsersList(data.users);
      if (data.logs) setLogs(data.logs);
      if (data.blacklist) setBlacklist(data.blacklist);
      if (typeof data.isMaintenance !== 'undefined') setIsMaintenance(data.isMaintenance);
    } catch (e) {
       fetchPublicData(isBackground);
    }
    if (!isBackground) setLoading(false);
  };

  const fetchData = (isBackground = false) => {
    if (userRole === 'admin' || userRole === 'owner') {
      fetchAdminData(isBackground);
    } else {
      fetchPublicData(isBackground);
    }
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync');
      const data = await response.json();
      if (data.error) messageApi.error(`Hiba: ${data.error}`);
      else { messageApi.success(data.message || "Szinkronizálás sikeres!"); fetchData(true); }
    } catch (e) { messageApi.error("Hálózati hiba."); }
    setIsSyncing(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUserRole(null); setUserName(""); setUserEmail("");
    fetchPublicData(false);
  };

  const handleAuthSubmit = async (values) => {
    const action = isRegistering ? 'register' : 'login';
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...values }) });
      const data = await response.json();
      if (data.error) messageApi.error(data.error);
      else if (action === 'login') {
        messageApi.success(`Üdvözlünk, ${data.user.username}!`);
        setUserName(data.user.username); setUserEmail(data.user.email); setUserRole(data.user.role);
        setIsAuthModalOpen(false); authForm.resetFields();
        fetchAdminData(false);
      } else {
        messageApi.success('Sikeres regisztráció! Most jelentkezz be.');
        setIsRegistering(false);
        authForm.resetFields();
      }
    } catch (e) { messageApi.error("Szerver hiba történt."); }
  };

  const toggleMaintenance = async (newState) => {
    await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'TOGGLE_MAINTENANCE', payload: { isMaintenance: newState } }) });
    setIsMaintenance(newState); messageApi.success(newState ? "Karbantartás BEKAPCSOLVA." : "Karbantartás KIKAPCSOLVA."); fetchData(true);
  };

  const handleBanEmail = async (values) => {
    await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'BAN_EMAIL', payload: { email: values.email, reason: values.reason } }) });
    messageApi.success("E-mail cím feketelistára téve."); blacklistForm.resetFields(); fetchData(true);
  };

  const handleUnbanEmail = async (email) => {
    await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'UNBAN_EMAIL', payload: { email } }) });
    messageApi.success("Tiltás feloldva."); fetchData(true);
  };

  const handleExportDB = () => window.location.href = '/api/export-db';

  const handleCleanupOldEvents = async () => {
    try {
      const response = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'CLEANUP_OLD_EVENTS', payload: {} }) });
      const result = await response.json();
      if (result.error) messageApi.error(result.error);
      else { messageApi.success(`${result.count} db régi esemény törölve!`); fetchData(true); }
    } catch (e) { messageApi.error("Hálózati hiba történt."); }
  };

  const toggleUserRole = async (targetUser) => {
    const makeAdmin = targetUser.role !== 'admin';
    const targetId = String(targetUser._id || targetUser.id);
    await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'TOGGLE_ROLE', payload: { targetUserId: targetId, makeAdmin }}) });
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
    } catch (e) { messageApi.error("Hálózati hiba történt."); }
  };

  const handleDeleteUser = async (userId) => {
    await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'DELETE_USER', payload: { userId: String(userId) } }) });
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
    } catch (err) { messageApi.error('Hálózati hiba a feltöltésnél.'); }
    setIsUploading(false);
  };

  const saveEvent = async (values) => {
    const formValues = values || eventForm.getFieldsValue(); 
    try {
      const dummyObj = { game: formValues.game, category: formValues.category, name: formValues.name };
      const eventColor = getGameColor(dummyObj);

      const payload = { 
        ...formValues, 
        max_players: parseInt(formValues.max_players) || 16, 
        external_url: formValues.external_url || "", 
        imageUrl: formValues.imageUrl || "", 
        isExternalEvent: !!formValues.external_url,
        color: eventColor 
      };
      
      if (editingEventId) { 
        await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'EDIT_TOURNAMENT', payload: { id: editingEventId, ...payload } }) }); 
        messageApi.success("Frissítve!"); 
      } else { 
        await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'ADD_TOURNAMENT', payload }) }); 
        messageApi.success("Létrehozva!"); 
      }
      
      setIsEventModalOpen(false); eventForm.resetFields(); setEditingEventId(null); setIsExternalForm(false); 
      fetchData(true); 
    } catch (err) {}
  };

  const handleDeleteTournament = async (tournamentId) => { 
     await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'DELETE_TOURNAMENT', payload: { tournamentId: String(tournamentId), id: String(tournamentId) }}) }); 
     messageApi.success("Esemény törölve."); 
     fetchData(true); 
   };

  const initiateJoin = (tournament) => {
    setIsEventDetailsModalOpen(false);
    if (tournament.external_url) { window.open(tournament.external_url, '_blank'); return; }
    setSelectedEventToJoin(tournament); joinForm.setFieldsValue({ name: userName || "", email: userEmail || "" }); setIsJoinModalOpen(true);
  };

  const submitJoin = async (values) => {
    const eId = String(selectedEventToJoin._id || selectedEventToJoin.id);
    try {
      const response = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'JOIN_TOURNAMENT', payload: { tournamentId: eId, ...values }}) });
      const result = await response.json();
      if (result.error) { messageApi.error(result.error); return; }
      messageApi.success(result.isQueue ? "Várólistára kerültél!" : "Hely biztosítva!");
      setIsJoinModalOpen(false); joinForm.resetFields(); 
      fetchData(true);
    } catch (e) {}
  };

  const initiateUnsubscribe = (tournament) => {
    setIsEventDetailsModalOpen(false); setSelectedEventToJoin(tournament); unsubscribeForm.resetFields(); setIsUnsubscribeModalOpen(true);
  };

  const submitUnsubscribe = async (values) => {
    const eId = String(selectedEventToJoin._id || selectedEventToJoin.id);
    try {
      const response = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'UNSUBSCRIBE_BY_EMAIL', payload: { tournamentId: eId, email: values.email } }) });
      const result = await response.json();
      if (result.error) { messageApi.error(result.error); return; }
      messageApi.success("Sikeresen lejelentkeztél az eseményről."); setIsUnsubscribeModalOpen(false); 
      fetchData(true); 
    } catch (e) { messageApi.error("Hálózati hiba történt."); }
  };

  const handleRemoveRegistration = async (registrationId) => {
    try {
      await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'REMOVE_REGISTRATION', payload: { registrationId } }) });
      messageApi.success("Jelentkező törölve."); 
      fetchData(true); 
    } catch (err) {}
  };

  const formatEventDate = (dateString) => {
    if (!dateString) return "Hamarosan"; 
    const d = new Date(dateString); if (isNaN(d.getTime())) return dateString; 
    return (d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' })).replace(/^\w/, c => c.toUpperCase());
  };

  return {
    tournaments, setTournaments, loading, userRole, userName, userEmail, usersList,
    selectedStore, handleSelectStore, 
    isMaintenance, toggleMaintenance, logs, isLogModalOpen, setIsLogModalOpen, blacklist, isBlacklistModalOpen, setIsBlacklistModalOpen, handleBanEmail, handleUnbanEmail, blacklistForm, handleExportDB, handleCleanupOldEvents,
    isSyncing, handleSync,
    isAuthModalOpen, setIsAuthModalOpen, isRegistering, setIsRegistering, authForm, handleAuthSubmit, handleLogout, toggleUserRole,
    isPasswordModalOpen, setIsPasswordModalOpen, selectedUserForPassword, passwordForm, initiatePasswordChange, submitPasswordChange, handleDeleteUser,
    isEventModalOpen, setIsEventModalOpen, isUsersModalOpen, setIsUsersModalOpen, isExternalForm, setIsExternalForm, editingEventId, setEditingEventId, eventForm, saveEvent, handleDeleteTournament,
    isUploading, handleImageUpload, isEventDetailsModalOpen, setIsEventDetailsModalOpen, selectedEventDetails, setSelectedEventDetails,
    isJoinModalOpen, setIsJoinModalOpen, selectedEventToJoin, joinForm, initiateJoin, submitJoin,
    isUnsubscribeModalOpen, setIsUnsubscribeModalOpen, unsubscribeForm, initiateUnsubscribe, submitUnsubscribe,
    isAttendeesModalOpen, setIsAttendeesModalOpen, selectedEventIdForAttendees, setSelectedEventIdForAttendees, registrations, handleRemoveRegistration,
    messageApi, contextHolder, formatEventDate, fetchData
  };
};