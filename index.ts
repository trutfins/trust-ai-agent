async function handleAuth() {
  const email = authEmail.value.trim();
  const password = authPassword.value;
  if (!email || !password) { showAuthError('يرجى إدخال البريد الإلكتروني وكلمة المرور'); return; }
  
  authSubmit.disabled = true;
  authSubmit.textContent = 'جاري المعالجة...';
  authError.classList.remove('show');

  try {
    let result;
    if (authMode === 'login') {
      result = await supabase.auth.signInWithPassword({ email, password });
    } else {
      result = await supabase.auth.signUp({ email, password });
    }

    if (result.error) {
      const msg = result.error.message.includes('Invalid login') ? 'البريد أو كلمة المرور غير صحيحة' :
                   result.error.message.includes('already registered') ? 'هذا البريد مسجل بالفعل' :
                   result.error.message;
      showAuthError(msg);
      authSubmit.disabled = false;
      authSubmit.textContent = authMode === 'login' ? 'دخول' : 'إنشاء حساب';
      return;
    }

    if (authMode === 'signup' && result.data.user && !result.data.session) {
      showAuthError('تم إنشاء الحساب بنجاح. يرجى تسجيل الدخول.');
      switchTab('login');
      authPassword.value = '';
      authSubmit.disabled = false;
      authSubmit.textContent = 'دخول';
      return;
    }

    // في حال النجاح التام لتسجيل الدخول:
    if (result.data.session && result.data.user) {
      showApp(result.data.user);
    }
  } catch (e) {
    showAuthError('حدث خطأ غير متوقع في الاتصال. يرجى المحاولة مرة أخرى.');
    authSubmit.disabled = false;
    authSubmit.textContent = authMode === 'login' ? 'دخول' : 'إنشاء حساب';
  }
}
