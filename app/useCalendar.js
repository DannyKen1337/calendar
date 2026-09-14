"use client";
import { useState, useEffect } from "react";
import { message, Form } from "antd";

const IMGBB_API_KEY = "IDE_JON_AZ_IMGBB_KULCSOD"; 

export const useCalendar = () => {
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false); // ÚJ: Szinkronizálás töltés állapota

  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [usersList, setUsersList] = useState([]);
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

  const [eventForm] = Form.useForm();
  const [joinForm] = Form.useForm();
  const [unsubscribeForm] = Form.useForm();
  const [authForm] = Form.useForm();
  const [messageApi, contextHolder] = message.useMessage();

  useEffect(() => {
    const storedSession = localStorage.getItem('tavern_calendar_session');
    if (storedSession) {
      try { 
        const userData = JSON.parse(storedSession); 
        setUserName(userData.username); 
        setUserEmail(userData.email); 
        setUserRole(userData.role); 
      } catch (error) { localStorage.removeItem('tavern_calendar_session'); }
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/data?t=${Date.now()}`);
      const data = await response.json();
      if (data.tournaments) setTournaments(data.tournaments);
      if (data.registrations) setRegistrations(data.registrations);
      if (data.users) setUsersList(data.users);
    } catch (e) {}
    setLoading(false);
  };

  // ÚJ: MANUÁLIS SZINKRONIZÁLÁS GOMB LOGIKÁJA
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync');
      const data = await response.json();
      if (data.error) {
        messageApi.error(`Hiba történt: ${data.error}`);
      } else {
        messageApi.success(data.message || "Szinkronizálás sikeres!");
        fetchData(); // Azonnal frissítjük a naptár rácsát az új eseményekkel!
      }
    } catch (e) {
      messageApi.error("Hálózati hiba a szinkronizáláskor.");
    }
    setIsSyncing(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('tavern_calendar_session');
    setUserRole(null); setUserName(""); setUserEmail("");
    messageApi.info("Kijelentkezve.");
  };

  const handleAuthSubmit = async (values) => {
    const action = isRegistering ? 'register' : 'login';
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...values }) });
      const data = await response.json();
      if (data.error) messageApi.error(data.error);
      else {
        messageApi.success(`Üdvözlünk, ${data.user.username}!`);
        localStorage.setItem('tavern_calendar_session', JSON.stringify({ username: data.user.username, email: data.user.email, role: data.user.role }));
        setUserName(data.user.username); setUserEmail(data.user.email); setUserRole(data.user.role);
        setIsAuthModalOpen(false); authForm.resetFields();
      }
    } catch (e) { messageApi.error("Hiba a bejelentkezésnél."); }
  };

  const toggleUserRole = async (targetUser) => {
    const makeAdmin = targetUser.role !== 'admin';
    const targetId = String(targetUser._id || targetUser.id);
    await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'TOGGLE_ROLE', payload: { targetUserId: targetId, makeAdmin }}) });
    fetchData();
  };

  const handleImageUpload = async (info, targetForm) => {
    if (IMGBB_API_KEY === "IDE_JON_AZ_IMGBB_KULCSOD") { messageApi.error("ImgBB API kulcs hiányzik!"); return; }
    const file = info.file.originFileObj || info.file; if (!file) return;
    setIsUploading(true);
    const formData = new FormData(); formData.append('image', file);
    try {
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) { targetForm.setFieldsValue({ imageUrl: data.data.url }); messageApi.success('Kép feltöltve!'); } 
      else { messageApi.error('Hiba a feltöltésnél.'); }
    } catch (err) { }
    setIsUploading(false);
  };

  const saveEvent = async (values) => {
    // Biztosítjuk, hogy a gombnyomásról is megkapja az értékeket
    const formValues = values || eventForm.getFieldsValue(); 
    try {
      const payload = { 
        ...formValues, 
        max_players: parseInt(formValues.max_players) || 16, 
        external_url: formValues.external_url || "", 
        imageUrl: formValues.imageUrl || "", 
        isExternalEvent: !!formValues.external_url, 
        userRole: userName 
      };
      
      if (editingEventId) { 
        await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'EDIT_TOURNAMENT', payload: { id: editingEventId, ...payload } }) }); 
        messageApi.success("Frissítve!"); 
      } else { 
        await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'ADD_TOURNAMENT', payload }) }); 
        messageApi.success("Létrehozva!"); 
      }
      
      setIsEventModalOpen(false); 
      eventForm.resetFields(); 
      setEditingEventId(null); 
      setIsExternalForm(false); 
      fetchData();
    } catch (err) {}
  };

  const handleDeleteTournament = async (tournamentId) => { 
    await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'DELETE_TOURNAMENT', payload: { tournamentId: String(tournamentId), id: String(tournamentId) }}) }); 
    messageApi.success("Esemény törölve."); fetchData(); 
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
      setIsJoinModalOpen(false); joinForm.resetFields(); fetchData();
    } catch (e) {}
  };

  const initiateUnsubscribe = (tournament) => {
    setIsEventDetailsModalOpen(false);
    setSelectedEventToJoin(tournament);
    unsubscribeForm.resetFields();
    setIsUnsubscribeModalOpen(true);
  };

  const submitUnsubscribe = async (values) => {
    const eId = String(selectedEventToJoin._id || selectedEventToJoin.id);
    try {
      const response = await fetch('/api/actions', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify({ actionType: 'UNSUBSCRIBE_BY_EMAIL', payload: { tournamentId: eId, email: values.email } }) 
      });
      const result = await response.json();
      if (result.error) { 
        messageApi.error(result.error); 
        return; 
      }
      messageApi.success("Sikeresen lejelentkeztél az eseményről.");
      setIsUnsubscribeModalOpen(false); 
      fetchData(); 
    } catch (e) {
      messageApi.error("Hálózati hiba történt.");
    }
  };

  const handleRemoveRegistration = async (registrationId) => {
    try {
      await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actionType: 'REMOVE_REGISTRATION', payload: { registrationId } }) });
      messageApi.success("Törölve."); fetchData(); 
    } catch (err) {}
  };

  const formatEventDate = (dateString) => {
    if (!dateString) return "Hamarosan";
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString; 
    return (d.toLocaleDateString('hu-HU', { month: 'short', day: 'numeric', weekday: 'long', hour: '2-digit', minute: '2-digit' })).replace(/^\w/, c => c.toUpperCase());
  };

  return {
    tournaments, setTournaments, loading, userRole, userName, userEmail, usersList,
    isSyncing, handleSync, // ÚJ SZINKRON VÁLTOZÓK
    isAuthModalOpen, setIsAuthModalOpen, isRegistering, setIsRegistering, authForm, handleAuthSubmit, handleLogout, toggleUserRole,
    isEventModalOpen, setIsEventModalOpen, isUsersModalOpen, setIsUsersModalOpen, isExternalForm, setIsExternalForm, editingEventId, setEditingEventId, eventForm, saveEvent, handleDeleteTournament,
    isUploading, handleImageUpload, isEventDetailsModalOpen, setIsEventDetailsModalOpen, selectedEventDetails, setSelectedEventDetails,
    isJoinModalOpen, setIsJoinModalOpen, selectedEventToJoin, joinForm, initiateJoin, submitJoin,
    isUnsubscribeModalOpen, setIsUnsubscribeModalOpen, unsubscribeForm, initiateUnsubscribe, submitUnsubscribe,
    isAttendeesModalOpen, setIsAttendeesModalOpen, selectedEventIdForAttendees, setSelectedEventIdForAttendees, registrations, handleRemoveRegistration,
    messageApi, contextHolder, formatEventDate, fetchData
  };
};