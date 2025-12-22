"use client";

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

export const WeeklyUsageChart = () => {
    const data = {
        labels: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัส', 'ศุกร์', 'เสาร์', 'อาทิตย์'],
        datasets: [
            {
                label: 'การเบิกใช้วัสดุ',
                data: [12, 19, 3, 5, 2, 3, 9],
                borderColor: 'rgb(13, 148, 136)', // Teal 600
                backgroundColor: 'rgba(13, 148, 136, 0.5)',
                tension: 0.3,
            },
            {
                label: 'การยืมเครื่องมือ',
                data: [5, 10, 8, 15, 6, 4, 7],
                borderColor: 'rgb(249, 115, 22)', // Orange 500
                backgroundColor: 'rgba(249, 115, 22, 0.5)',
                tension: 0.3,
            },
        ],
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: false,
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: {
                    color: '#f3f4f6',
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        }
    };

    return <Line options={options} data={data} />;
};

export const EquipmentStatusChart = () => {
    const data = {
        labels: ['พร้อมใช้งาน', 'กำลังใช้งาน', 'ซ่อมบำรุง', 'สูญหาย/ชำรุด'],
        datasets: [
            {
                data: [30, 15, 5, 2],
                backgroundColor: [
                    'rgba(34, 197, 94, 0.8)', // Green
                    'rgba(59, 130, 246, 0.8)', // Blue
                    'rgba(249, 115, 22, 0.8)', // Orange
                    'rgba(239, 68, 68, 0.8)',  // Red
                ],
                borderWidth: 0,
            },
        ],
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'right' as const,
            },
        },
        cutout: '70%',
    };

    return <Doughnut data={data} options={options} />;
};
