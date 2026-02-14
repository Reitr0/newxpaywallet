// src/app/screens/wallet/ui/QRScannerScreen.js
import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import VBack from '@src/shared/ui/primitives/VBack';
import VText from '@src/shared/ui/primitives/VText';
import VPressable from '@src/shared/ui/primitives/VPressable';
import VIcon from '@src/shared/ui/atoms/VIcon';

// Lazy import camera to prevent crash on load
let Camera, useCameraDevice, useCodeScanner;
try {
    const VisionCamera = require('react-native-vision-camera');
    Camera = VisionCamera.Camera;
    useCameraDevice = VisionCamera.useCameraDevice;
    useCodeScanner = VisionCamera.useCodeScanner;
} catch (e) {
    console.log('Vision Camera not available:', e);
}

function CameraScanner({ onCodeScanned, scanned }) {
    const device = useCameraDevice('back');

    const codeScanner = useCodeScanner({
        codeTypes: ['qr'],
        onCodeScanned: (codes) => {
            if (!scanned && codes.length > 0 && codes[0].value) {
                onCodeScanned(codes[0].value);
            }
        },
    });

    if (!device) {
        return (
            <View style={styles.permissionContainer}>
                <VText className="text-muted text-center">No camera device found</VText>
            </View>
        );
    }

    return (
        <>
            <Camera
                style={styles.camera}
                device={device}
                isActive={!scanned}
                codeScanner={codeScanner}
            />
            <View style={styles.overlay}>
                <View style={styles.scanFrame} />
                <VText className="text-white text-center px-4 mt-6">
                    Position QR code within the frame to scan
                </VText>
            </View>
        </>
    );
}

export default function QRScannerScreen({ navigation, route }) {
    const [hasPermission, setHasPermission] = useState(false);
    const [permissionChecked, setPermissionChecked] = useState(false);
    const [scanned, setScanned] = useState(false);
    const [cameraAvailable, setCameraAvailable] = useState(!!Camera);
    const { onScan } = route.params || {};

    useEffect(() => {
        const requestPermission = async () => {
            try {
                if (Platform.OS === 'android') {
                    const granted = await PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.CAMERA,
                        {
                            title: 'Camera Permission',
                            message: 'XPay needs camera access to scan QR codes',
                            buttonNeutral: 'Ask Me Later',
                            buttonNegative: 'Cancel',
                            buttonPositive: 'OK',
                        }
                    );
                    setHasPermission(granted === PermissionsAndroid.RESULTS.GRANTED);
                } else if (Camera) {
                    const status = await Camera.requestCameraPermission();
                    setHasPermission(status === 'granted');
                }
            } catch (err) {
                console.log('Permission error:', err);
                setHasPermission(false);
            }
            setPermissionChecked(true);
        };

        requestPermission();
    }, []);

    const handleCodeScanned = (address) => {
        setScanned(true);
        if (onScan && address) {
            onScan(address);
        }
        navigation.goBack();
    };

    const handleOpenSettings = () => {
        Linking.openSettings();
    };

    // Camera not available - show fallback
    if (!cameraAvailable) {
        return (
            <View style={styles.container}>
                <View style={styles.headerFixed}>
                    <VBack />
                    <View style={styles.headerCenter}>
                        <VText className="text-title font-semibold text-base">Scan QR Code</VText>
                    </View>
                    <View style={styles.headerSpacer} />
                </View>
                <View style={styles.permissionContainer}>
                    <VIcon name="camera-off-outline" type="MaterialCommunityIcons" size={48} className="text-muted" />
                    <VText className="text-muted text-center mt-4 px-6">
                        Camera is not available on this device.
                    </VText>
                    <VPressable
                        style={styles.button}
                        onPress={() => navigation.goBack()}
                    >
                        <VText className="text-link font-medium">Go Back</VText>
                    </VPressable>
                </View>
            </View>
        );
    }

    // Waiting for permission check
    if (!permissionChecked) {
        return (
            <View style={styles.container}>
                <View style={styles.headerFixed}>
                    <VBack />
                    <View style={styles.headerCenter}>
                        <VText className="text-title font-semibold text-base">Scan QR Code</VText>
                    </View>
                    <View style={styles.headerSpacer} />
                </View>
                <View style={styles.permissionContainer}>
                    <VText className="text-muted text-center">Checking camera permission...</VText>
                </View>
            </View>
        );
    }

    // Permission denied
    if (!hasPermission) {
        return (
            <View style={styles.container}>
                <View style={styles.headerFixed}>
                    <VBack />
                    <View style={styles.headerCenter}>
                        <VText className="text-title font-semibold text-base">Scan QR Code</VText>
                    </View>
                    <View style={styles.headerSpacer} />
                </View>
                <View style={styles.permissionContainer}>
                    <VIcon name="camera-off-outline" type="MaterialCommunityIcons" size={48} className="text-muted" />
                    <VText className="text-muted text-center mt-4 px-6">
                        Camera permission is required to scan QR codes.
                    </VText>
                    <VPressable
                        style={styles.button}
                        onPress={handleOpenSettings}
                    >
                        <VText className="text-link font-medium">Open Settings</VText>
                    </VPressable>
                </View>
            </View>
        );
    }

    // Camera ready
    return (
        <View style={styles.container}>
            <View style={styles.headerFixed}>
                <VBack />
                <View style={styles.headerCenter}>
                    <VText className="text-title font-semibold text-base">Scan QR Code</VText>
                </View>
                <View style={styles.headerSpacer} />
            </View>

            <CameraScanner onCodeScanned={handleCodeScanned} scanned={scanned} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    headerFixed: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingTop: 8,
        paddingBottom: 8,
        backgroundColor: 'rgba(0,0,0,0.7)',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10,
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerSpacer: {
        width: 40,
    },
    camera: {
        flex: 1,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
    },
    button: {
        marginTop: 20,
        padding: 12,
        backgroundColor: '#1a1a2e',
        borderRadius: 8,
    },
    overlay: {
        position: 'absolute',
        top: 60,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanFrame: {
        width: 250,
        height: 250,
        borderWidth: 2,
        borderColor: '#5976fe',
        borderRadius: 20,
        backgroundColor: 'transparent',
    },
});
