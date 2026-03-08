export async function checkAuth() {
  try {
    const response = await fetch('http://localhost:8000/auth/me', {
      credentials: 'include',
    });
    if (response.ok) {
      return await response.json();
    }
    return null;
  } catch {
    return null;
  }
}

export async function checkHasUsers() {
  try {
    const response = await fetch('http://localhost:8000/auth/check');
    if (response.ok) {
      const data = await response.json();
      return data.has_users;
    }
    return false;
  } catch {
    return false;
  }
}

export async function logout() {
  try {
    await fetch('http://localhost:8000/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (error) {
    console.error('Logout failed:', error);
  }
}
