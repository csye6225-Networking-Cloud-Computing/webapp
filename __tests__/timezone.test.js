const moment = require('moment-timezone');
const convertToEST = require('../utils/timezone'); // Path to your timezone utility

describe('convertToEST utility function', () => {
    it('should convert account_created and account_updated to EST/EDT timezone', () => {
        const user = {
            account_created: new Date('2024-01-01T12:00:00Z'),
            account_updated: new Date('2024-01-01T12:00:00Z')
        };
        const updatedUser = convertToEST(user);

        const expectedCreated = moment('2024-01-01T12:00:00Z').tz('America/New_York').format();
        const expectedUpdated = moment('2024-01-01T12:00:00Z').tz('America/New_York').format();

        expect(updatedUser.account_created).toBe(expectedCreated);
        expect(updatedUser.account_updated).toBe(expectedUpdated);
    });
});
