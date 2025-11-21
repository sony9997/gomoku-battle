import React, { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Text, useTexture, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

const BOARD_SIZE = 15;
const CELL_SIZE = 1;
const BOARD_WIDTH = (BOARD_SIZE - 1) * CELL_SIZE;

const Stone = ({ position, color }) => {
    return (
        <mesh position={position} castShadow receiveShadow>
            <sphereGeometry args={[0.4, 32, 16]} />
            <meshStandardMaterial
                color={color === 'Black' ? '#1a1a1a' : '#f0f0f0'}
                roughness={0.1}
                metalness={0.1}
            />
            <mesh scale={[1, 0.2, 1]} position={[0, -0.3, 0]}>
                {/* Flattening the bottom slightly visually or just sinking it */}
            </mesh>
        </mesh>
    );
};

const GridLines = () => {
    const lines = [];
    const offset = BOARD_WIDTH / 2;

    for (let i = 0; i < BOARD_SIZE; i++) {
        const pos = i * CELL_SIZE - offset;

        // Vertical lines
        lines.push(
            <mesh key={`v-${i}`} position={[pos, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
                <planeGeometry args={[0.05, BOARD_WIDTH]} />
                <meshBasicMaterial color="#000" opacity={0.5} transparent />
            </mesh>
        );

        // Horizontal lines
        lines.push(
            <mesh key={`h-${i}`} position={[0, 0.01, pos]} rotation={[-Math.PI / 2, 0, Math.PI / 2]} receiveShadow>
                <planeGeometry args={[0.05, BOARD_WIDTH]} />
                <meshBasicMaterial color="#000" opacity={0.5} transparent />
            </mesh>
        );
    }
    return <group>{lines}</group>;
};

const BoardMesh = ({ squares, onClick, xIsNext }) => {
    const [hovered, setHovered] = useState(null);

    const handlePointerMove = (e) => {
        e.stopPropagation();
        const point = e.point;
        const offset = BOARD_WIDTH / 2;

        // Convert world point to grid index
        const x = Math.round((point.x + offset) / CELL_SIZE);
        const z = Math.round((point.z + offset) / CELL_SIZE);

        if (x >= 0 && x < BOARD_SIZE && z >= 0 && z < BOARD_SIZE) {
            setHovered({ x, z });
        } else {
            setHovered(null);
        }
    };

    const handleClick = (e) => {
        e.stopPropagation();
        if (hovered) {
            const index = hovered.z * BOARD_SIZE + hovered.x;
            onClick(index);
        }
    };

    const offset = BOARD_WIDTH / 2;

    return (
        <group>
            {/* The Board Base */}
            <mesh
                position={[0, -0.5, 0]}
                receiveShadow
                onPointerMove={handlePointerMove}
                onPointerOut={() => setHovered(null)}
                onClick={handleClick}
            >
                <boxGeometry args={[BOARD_WIDTH + 2, 1, BOARD_WIDTH + 2]} />
                <meshStandardMaterial color="#e6b333" roughness={0.5} />
            </mesh>

            {/* Grid Lines */}
            <GridLines />

            {/* Placed Stones */}
            {squares.map((color, i) => {
                if (!color) return null;
                const row = Math.floor(i / BOARD_SIZE);
                const col = i % BOARD_SIZE;
                const x = col * CELL_SIZE - offset;
                const z = row * CELL_SIZE - offset;
                return <Stone key={i} position={[x, 0.2, z]} color={color} />;
            })}

            {/* Ghost Stone (Hover) */}
            {hovered && !squares[hovered.z * BOARD_SIZE + hovered.x] && (
                <mesh position={[hovered.x * CELL_SIZE - offset, 0.2, hovered.z * CELL_SIZE - offset]}>
                    <sphereGeometry args={[0.4, 32, 16]} />
                    <meshStandardMaterial
                        color={xIsNext ? '#1a1a1a' : '#f0f0f0'}
                        transparent
                        opacity={0.5}
                    />
                </mesh>
            )}
        </group>
    );
};

export default function Board3D({ squares, onClick, xIsNext }) {
    return (
        <div style={{ width: '100%', height: '700px', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
            <Canvas shadows camera={{ position: [0, 25, 15], fov: 50 }}>
                <ambientLight intensity={0.5} />
                <directionalLight
                    position={[10, 20, 10]}
                    intensity={1.5}
                    castShadow
                    shadow-mapSize={[2048, 2048]}
                />
                <Environment preset="city" />

                <group position={[0, 0, 0]}>
                    <BoardMesh squares={squares} onClick={onClick} xIsNext={xIsNext} />
                </group>

                <ContactShadows opacity={0.5} scale={30} blur={2} far={4} />
                <OrbitControls
                    minPolarAngle={0}
                    maxPolarAngle={Math.PI / 2.2}
                    enableZoom={true}
                    minDistance={5}
                    maxDistance={60}
                />
            </Canvas>
        </div>
    );
}
