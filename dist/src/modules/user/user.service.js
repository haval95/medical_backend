import { prisma } from '../../prisma/client.js';
import { ApiError } from '../../utils/ApiError.js';
export const getMyUserProfile = async (userId) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            doctorProfile: {
                include: {
                    location: true,
                },
            },
            patientProfile: true,
        },
    });
    if (!user) {
        throw new ApiError(404, 'User not found');
    }
    return user;
};
export const listUsers = async () => prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
        doctorProfile: {
            include: { location: true },
        },
        patientProfile: true,
    },
});
