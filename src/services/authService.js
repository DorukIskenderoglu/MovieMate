// Authentication Service - Manages user accounts and sessions in localStorage

const USERS_STORAGE_KEY = 'movieMate_users';
const CURRENT_USER_STORAGE_KEY = 'movieMate_currentUser';

/**
 * Generate a simple unique ID for users
 */
function generateUserId() {
    return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Get all users from localStorage
 */
function getAllUsers() {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return [];
        }
        const data = localStorage.getItem(USERS_STORAGE_KEY);
        if (!data) return [];
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading users:', error);
        return [];
    }
}

/**
 * Save all users to localStorage
 */
function saveAllUsers(users) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
        return true;
    } catch (error) {
        console.error('Error saving users:', error);
        return false;
    }
}

/**
 * Sign up a new user
 */
export function signUp(email, password, name) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return { success: false, error: 'localStorage not available' };
        }

        // Validate inputs
        if (!email || !password || !name) {
            return { success: false, error: 'Tüm alanlar doldurulmalıdır' };
        }

        // Validate email format and domain
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { success: false, error: 'Geçerli bir e-posta adresi giriniz' };
        }
        
        // Check if email domain is allowed
        const allowedDomains = ['gmail.com', 'hotmail.com', 'hotmail.com.tr'];
        const emailDomain = email.toLowerCase().split('@')[1];
        if (!allowedDomains.includes(emailDomain)) {
            return { success: false, error: 'Sadece @gmail.com, @hotmail.com veya @hotmail.com.tr e-posta adresleri kabul edilir' };
        }

        // Check if user already exists (prevent duplicate email signups)
        const users = getAllUsers();
        const existingUser = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (existingUser) {
            return { success: false, error: 'Bu e-posta adresi zaten kullanılıyor' };
        }

        // Validate password length
        if (password.length < 6) {
            return { success: false, error: 'Şifre en az 6 karakter olmalıdır' };
        }

        // Create new user
        const newUser = {
            id: generateUserId(),
            email: email.toLowerCase(),
            password: password, // Plain text as per requirements
            name: name.trim(),
            createdAt: new Date().toISOString(),
            blocked: false,
            blockedAt: null
        };

        // Save user
        users.push(newUser);
        saveAllUsers(users);

        // Auto-login after signup
        return login(email, password);
    } catch (error) {
        console.error('Error signing up:', error);
        return { success: false, error: 'Kayıt sırasında bir hata oluştu' };
    }
}

/**
 * Login a user
 */
export function login(email, password) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return { success: false, error: 'localStorage not available' };
        }

        // Validate inputs
        if (!email || !password) {
            return { success: false, error: 'E-posta ve şifre gerekli' };
        }

        // Find user
        const users = getAllUsers();
        const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
        
        if (!user) {
            return { success: false, error: 'E-posta veya şifre hatalı' };
        }

        // Check password (plain text comparison)
        if (user.password !== password) {
            return { success: false, error: 'E-posta veya şifre hatalı' };
        }

        // Check if user is blocked
        if (user.blocked === true) {
            return { success: false, error: 'Hesabınız engellenmiştir. Lütfen destek ekibi ile iletişime geçin.' };
        }

        // Set current user session
        const currentUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            blocked: user.blocked || false
        };
        localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(currentUser));

        return { success: true, user: currentUser };
    } catch (error) {
        console.error('Error logging in:', error);
        return { success: false, error: 'Giriş sırasında bir hata oluştu' };
    }
}

/**
 * Logout current user
 */
export function logout() {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
        return true;
    } catch (error) {
        console.error('Error logging out:', error);
        return false;
    }
}

/**
 * Get current logged-in user
 */
export function getCurrentUser() {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return null;
        }
        const data = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
        if (!data) return null;
        const user = JSON.parse(data);
        
        // Check if user is still blocked (in case they were blocked while logged in)
        const users = getAllUsers();
        const fullUser = users.find(u => u.id === user.id);
        if (fullUser && fullUser.blocked === true) {
            return { ...user, blocked: true };
        }
        
        return user;
    } catch (error) {
        console.error('Error getting current user:', error);
        return null;
    }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
    return getCurrentUser() !== null;
}

/**
 * Clear all authentication data from localStorage
 * This removes all users and current session
 */
export function clearAllAuthData() {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        
        // Clear all users
        localStorage.removeItem(USERS_STORAGE_KEY);
        
        // Clear current user session
        localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
        
        return true;
    } catch (error) {
        console.error('Error clearing auth data:', error);
        return false;
    }
}

/**
 * Block a user by user ID
 * @param {string} userId - User ID to block
 * @returns {boolean} Success status
 */
export function blockUser(userId) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        
        const users = getAllUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            return false;
        }
        
        users[userIndex].blocked = true;
        users[userIndex].blockedAt = new Date().toISOString();
        
        // If blocked user is currently logged in, log them out
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.id === userId) {
            logout();
        }
        
        return saveAllUsers(users);
    } catch (error) {
        console.error('Error blocking user:', error);
        return false;
    }
}

/**
 * Unblock a user by user ID
 * @param {string} userId - User ID to unblock
 * @returns {boolean} Success status
 */
export function unblockUser(userId) {
    try {
        if (typeof window === 'undefined' || !window.localStorage) {
            return false;
        }
        
        const users = getAllUsers();
        const userIndex = users.findIndex(u => u.id === userId);
        
        if (userIndex === -1) {
            return false;
        }
        
        users[userIndex].blocked = false;
        users[userIndex].blockedAt = null;
        
        return saveAllUsers(users);
    } catch (error) {
        console.error('Error unblocking user:', error);
        return false;
    }
}

/**
 * Check if a user is blocked
 * @param {string} userId - User ID to check
 * @returns {boolean} True if user is blocked
 */
export function isUserBlocked(userId) {
    try {
        const users = getAllUsers();
        const user = users.find(u => u.id === userId);
        return user ? (user.blocked === true) : false;
    } catch (error) {
        console.error('Error checking if user is blocked:', error);
        return false;
    }
}

/**
 * Get all users data for admin panel
 * This includes user statistics from userDataService
 * @returns {Array} Array of user objects with statistics
 */
export function getAllUsersData() {
    try {
        const users = getAllUsers();
        
        // Import userDataService functions dynamically to avoid circular dependency
        // For now, we'll get basic user info and the admin panel can fetch stats separately
        return users.map(user => ({
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt,
            blocked: user.blocked || false,
            blockedAt: user.blockedAt || null
        }));
    } catch (error) {
        console.error('Error getting all users data:', error);
        return [];
    }
}

