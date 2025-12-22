// Skeleton UI component สำหรับแสดงขณะโหลดข้อมูล

export default function SkeletonLoader() {
    return (
        <div className="min-h-screen bg-gray-50 animate-pulse">
            {/* Header Skeleton */}
            <div className="bg-white shadow">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
                            <div className="h-6 bg-gray-300 rounded w-32"></div>
                        </div>
                        <div className="w-8 h-8 bg-gray-300 rounded"></div>
                    </div>
                </div>
            </div>

            {/* Content Skeleton */}
            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    {[1, 2].map((i) => (
                        <div key={i} className="bg-white rounded-lg shadow p-6">
                            <div className="h-4 bg-gray-300 rounded w-3/4 mb-4"></div>
                            <div className="h-8 bg-gray-300 rounded w-1/2 mb-2"></div>
                            <div className="h-3 bg-gray-300 rounded w-full"></div>
                        </div>
                    ))}
                </div>

                {/* List Skeleton */}
                <div className="bg-white rounded-lg shadow">
                    <div className="p-4 border-b">
                        <div className="h-6 bg-gray-300 rounded w-48"></div>
                    </div>
                    <div className="divide-y">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="p-4 flex items-center space-x-4">
                                <div className="w-12 h-12 bg-gray-300 rounded"></div>
                                <div className="flex-1">
                                    <div className="h-4 bg-gray-300 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-gray-300 rounded w-1/2"></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
