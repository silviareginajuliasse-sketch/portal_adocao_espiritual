// Use relative path if on localhost to avoid CORS issues, otherwise use absolute
const API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? '/api'
    : 'http://localhost:3000/api';

/**
 * Busca dados de uma tabela específica
 * @param {string} table Nome da tabela (ex: 'regional', 'arquidiocese')
 * @returns {Promise<Array>} Lista de registros
 */
async function fetchData(table) {
    try {
        const response = await fetch(`${API_URL}/${table}`);
        if (!response.ok) throw new Error('Erro ao buscar dados');
        return await response.json();
    } catch (error) {
        console.error(`Erro na API (${table}):`, error);
        return [];
    }
}

/**
 * Salva um novo registro em uma tabela
 * @param {string} table Nome da tabela
 * @param {Object} data Objeto com os campos da tabela
 * @returns {Promise<Object>} Registro criado
 */
async function postData(table, data) {
    try {
        const response = await fetch(`${API_URL}/${table}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || 'Erro ao salvar dados');
        }
        
        return await response.json();
    } catch (error) {
        console.error(`Erro na API (${table}):`, error.message);
        throw error;
    }
}

/**
 * Exclui um registro de uma tabela
 * @param {string} table Nome da tabela
 * @returns {Promise<Object>} Resultado da exclusão
 */
async function deleteData(table) {
    try {
        const response = await fetch(`${API_URL}/${table}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error('Erro ao excluir dados');
        return await response.json();
    } catch (error) {
        console.error(`Erro na API (DELETE ${table}):`, error);
        throw error;
    }
}
