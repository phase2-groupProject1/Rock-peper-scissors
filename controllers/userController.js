const { User } = require('../models');

// Register user baru
exports.register = async (req, res) => {
	try {
		const { username } = req.body;
		if (!username) {
			return res.status(400).json({ message: 'Username is required' });
		}
		const user = await User.create({ username });
		res.status(201).json({
			message: 'User registered successfully',
			user: {
				id: user.id,
				username: user.username
			}
		});
	} catch (error) {
		res.status(500).json({ message: 'Internal server error', error: error.message });
	}
};
