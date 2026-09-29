const https = require('https');

function httpsRequest(url, options = {}, postData = null) {
    return new Promise((resolve, reject) => {
        const parsedUrl = new URL(url);
        const reqOptions = {
            hostname: parsedUrl.hostname,
            path: parsedUrl.pathname + parsedUrl.search,
            method: options.method || 'GET',
            headers: options.headers || {},
            rejectUnauthorized: false
        };

        const req = https.request(reqOptions, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch {
                    resolve(data);
                }
            });
        });

        req.on('error', err => reject(err));

        if (postData) {
            req.write(typeof postData === 'string' ? postData : JSON.stringify(postData));
        }
        req.end();
    });
}

// 1. ค้นหาข้อมูลผู้ใช้ Roblox
async function getRobloxUser(username) {
    try {
        // หา User ID จาก Username
        const searchRes = await httpsRequest('https://users.roblox.com/v1/usernames/users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, { usernames: [username], excludeBannedUsers: false });

        if (!searchRes || !searchRes.data || searchRes.data.length === 0) {
            return null;
        }

        const userBasic = searchRes.data[0];
        const userId = userBasic.id;

        // ดึงข้อมูลละเอียด
        const userDetails = await httpsRequest(`https://users.roblox.com/v1/users/${userId}`);

        // ดึงรูป Avatar Headshot
        const avatarRes = await httpsRequest(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`);
        const avatarUrl = (avatarRes?.data?.[0]?.imageUrl) || null;

        // ดึงจำนวนเพื่อน
        const friendsRes = await httpsRequest(`https://friends.roblox.com/v1/users/${userId}/friends/count`);
        const friendCount = friendsRes?.count ?? 0;

        // ดึงจำนวนผู้ติดตาม
        const followersRes = await httpsRequest(`https://friends.roblox.com/v1/users/${userId}/followers/count`);
        const followerCount = followersRes?.count ?? 0;

        return {
            id: userId,
            username: userDetails.name || userBasic.name,
            displayName: userDetails.displayName || userBasic.displayName,
            description: userDetails.description || 'ไม่มีคำอธิบาย',
            created: userDetails.created,
            isBanned: userDetails.isBanned || false,
            hasVerifiedBadge: userDetails.hasVerifiedBadge || false,
            avatarUrl,
            friendCount,
            followerCount,
            profileUrl: `https://www.roblox.com/users/${userId}/profile`
        };
    } catch (err) {
        console.error('getRobloxUser error:', err);
        return null;
    }
}

// 2. ค้นหาข้อมูลแมพ Roblox
async function getRobloxGame(placeId) {
    try {
        const placeDetails = await httpsRequest(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`);
        if (!placeDetails || !placeDetails[0]) return null;

        const place = placeDetails[0];
        const universeId = place.universeId;

        let universe = {};
        if (universeId) {
            const universeRes = await httpsRequest(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
            universe = (universeRes?.data?.[0]) || {};
        }

        // ดึงรูปไอคอนเกม
        const iconRes = await httpsRequest(`https://thumbnails.roblox.com/v1/places/gameicons?placeIds=${placeId}&size=512x512&format=Png&isCircular=false`);
        const iconUrl = (iconRes?.data?.[0]?.imageUrl) || null;

        return {
            placeId,
            universeId,
            name: universe.name || place.name,
            description: universe.description || place.description || 'ไม่มีคำอธิบาย',
            playing: universe.playing ?? 0,
            visits: universe.visits ?? 0,
            favorites: universe.favoritedCount ?? 0,
            maxPlayers: universe.maxPlayers || place.maxPlayers || 0,
            creatorName: universe.creator?.name || place.builder || 'ไม่ระบุ',
            creatorType: universe.creator?.type || 'User',
            created: universe.created || place.created,
            updated: universe.updated || place.updated,
            iconUrl,
            gameUrl: `https://www.roblox.com/games/${placeId}`
        };
    } catch (err) {
        console.error('getRobloxGame error:', err);
        return null;
    }
}

// 3. ค้นหาข้อมูลกลุ่ม Roblox
async function getRobloxGroup(groupId) {
    try {
        const group = await httpsRequest(`https://groups.roblox.com/v1/groups/${groupId}`);
        if (!group || group.errors) return null;

        // ดึงรูปไอคอนกลุ่ม
        const iconRes = await httpsRequest(`https://thumbnails.roblox.com/v1/groups/icons?groupIds=${groupId}&size=420x420&format=Png&isCircular=false`);
        const iconUrl = (iconRes?.data?.[0]?.imageUrl) || null;

        return {
            id: group.id,
            name: group.name,
            description: group.description || 'ไม่มีคำอธิบาย',
            memberCount: group.memberCount || 0,
            owner: group.owner ? group.owner.username : 'ไม่มีเจ้าของ',
            ownerId: group.owner ? group.owner.userId : null,
            isLocked: group.isLocked || false,
            iconUrl,
            groupUrl: `https://www.roblox.com/groups/${group.id}`
        };
    } catch (err) {
        console.error('getRobloxGroup error:', err);
        return null;
    }
}

module.exports = {
    getRobloxUser,
    getRobloxGame,
    getRobloxGroup
};
