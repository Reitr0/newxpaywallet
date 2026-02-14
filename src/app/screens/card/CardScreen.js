import React, { useState } from 'react';
import { View, Text, StyleSheet, ImageBackground, TouchableOpacity, Image } from 'react-native';
import { useTranslation } from 'react-i18next';

const CardScreen = () => {
    const { t } = useTranslation();
    const [isActive, setIsActive] = useState(false); // Set default state to inactive
    const [cardImage, setCardImage] = useState(require('@assets/images/CardImage.png')); // Set default image to inactive

    const toggleActive = () => {
        setIsActive(!isActive);
        setCardImage(isActive
            ? require('@assets/images/CardImage.png')
            : require('@assets/images/CardImageActive.png')
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.coloredSection}></View>
            <Text style={[styles.cardLabel, isActive && { color: '#007bff' }]}>{t('CARD')}</Text>
            <Text style={[styles.amount, isActive && { color: '#000' }]}>{t('Amount')} (XUSDT)</Text>
            <Text style={[styles.amountValue, isActive && { color: '#000' }]}>{isActive ? '$3698' : '$0'}</Text>
            {isActive ? (
                <>
                    <ImageBackground
                        source={cardImage}
                        style={styles.cardImage}
                    >
                    </ImageBackground>
                    <View style={styles.buttonsContainer}>
                        <TouchableOpacity style={styles.button}>
                            <Image source={require('@assets/images/Topup.png')} style={styles.buttonImage} />
                            <Text style={styles.buttonText}>{t('TopUp')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.button}>
                            <Image source={require('@assets/images/Freeze.png')} style={styles.buttonImage} />
                            <Text style={styles.buttonText}>{t('Freeze')}</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.transactions}>
                        <Text style={styles.transactionsHeader}>{t('LatestTransaction')}</Text>
                        <View style={styles.transactionItem}>
                            <Text style={styles.textdesc}>Withdrawal fee</Text>
                            <Text style={styles.transactionAmount}>- $2.00</Text>
                        </View>
                        <View style={styles.transactionItem}>
                            <Text style={styles.textsub}>Transfer from 2024-11-29</Text>
                        </View>
                        <View style={styles.transactionItem}>
                            <Text style={styles.textdesc}>Withdraw</Text>
                            <Text style={styles.transactionAmountGreen}>- $100.00</Text>
                        </View>
                        <View style={styles.transactionItem}>
                            <Text style={styles.textsub}>Transfer from 2024-11-29</Text>
                        </View>
                    </View>
                </>
            ) : (
                <View>
                    {/*<View style={styles.BackgroundContainer}>*/}
                    <ImageBackground
                        source={cardImage}
                        style={styles.cardImage}
                    >
                    </ImageBackground>
                    {/*</View>*/}
                    <TouchableOpacity style={styles.toggleButton}
                    // onPress={toggleActive}
                    >
                        <Text style={styles.toggleButtonText}>{isActive ? t('Deactivate') : t('Activate')}</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    textsub: {
        color: '#808080'
    },
    textdesc: {
        color: 'black'
    },
    BackgroundContainer: {
        width: 300,
        height: 150,
        backgroundColor: '#007bff',
        borderBottomLeftRadius: 100,
        borderBottomRightRadius: 100,
    },
    buttonImage: {
        width: 30, // Adjust size as needed
        height: 30, // Adjust size as needed
        resizeMode: 'contain',
    },
    coloredSection: {
        height: 500 * 0.25,
        backgroundColor: '#5976fe',
        borderBottomLeftRadius: 30, // Adjust the radius as needed
        borderBottomRightRadius: 30,
    },
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: 'fff',
        alignItems: 'center',
    },
    cardLabel: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        alignSelf: 'flex-start',
        color: '#007bff',
    },
    cardImage: {
        width: '100%',
        aspectRatio: 1.6,
        resizeMode: 'contain',
        marginTop: 20,
        marginBottom: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    amount: {
        color: 'white',
        fontSize: 16,
        marginBottom: 5,
        position: 'absolute',
        top: 20,
    },
    amountValue: {
        color: 'white',
        fontSize: 24,
        fontWeight: 'bold',
        position: 'absolute',
        top: 50,
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        width: '100%',
        marginBottom: 20,
    },
    button: {
        backgroundColor: '#5976fe',
        padding: 10,
        borderRadius: 5,
        width: '40%',
        alignItems: 'center',
    },
    buttonText: {
        color: '#fff',
    },
    transactions: {
        padding: 20,
        backgroundColor: '#fff',
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    transactionsHeader: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 15,
        color: '#5976fe',
    },
    transactionItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor:
            '#eee',
        color: '#000',
    },
    transactionAmount: {
        color: 'red',
    },
    transactionAmountGreen: {
        color: 'green',
    },
    activeButton: {
        backgroundColor: '#007bff',
        padding: 15,
        borderRadius: 5,
        width: '100%',
    },
    activeText: {
        color: 'white',
        textAlign: 'center',
        fontWeight: 'bold',
    },
    toggleButton: {
        backgroundColor: '#007bff',
        padding: 15,
        borderRadius: 15,
        width: 120,
        marginTop: 50,
        alignSelf: 'center',
    },
    toggleButtonText: {
        color: 'white',
        textAlign: 'center',
        fontWeight: 'bold',
    },
});

export default CardScreen;
