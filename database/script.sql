CREATE database oficina;
use oficina;

create table clientes (
	id_cliente INT AUTO_INCREMENT PRIMARY KEY,
    nome_cliente VARCHAR(250) NOT NULL,
    senha_cliente VARCHAR(255) NOT NULL,
    email_cliente VARCHAR(200) NOT NULL UNIQUE,
    criado_em TIMESTAMP DEFAULT current_timestamp,
    telefone_cliente VARCHAR(30),
    cep_cliente VARCHAR(12) NOT NULL UNIQUE
);

INSERT INTO clientes (nome_cliente, senha_cliente, email_cliente, telefone_cliente, cep_cliente) VALUES
('Emanuelly', 'Manu@23467', 'emanuelly@gmail.com', '11 1234567', '123456789012');

CREATE TABLE usuarios(
	id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nome_usuario VARCHAR(250) NOT NULL,
    senha_usuario VARCHAR(150) NOT NULL,
    email_usuario VARCHAR(200) NOT NULL,
    criado_em TIMESTAMP DEFAULT current_timestamp,
    telefone_usuario VARCHAR(30)
);

INSERT INTO usuarios (nome_usuario, senha_usuario, email_usuario, telefone_usuario) VALUES
('Yasmin', 'Yas@12342', 'yasmin@gmail.com', '11 987654231');

CREATE TABLE veiculos(
	id_veiculo INT auto_increment PRIMARY KEY,
    marca VARCHAR(200) NOT NULL,
    modelo VARCHAR(200) NOT NULL
);

INSERT INTO veiculos(marca, modelo) VALUES
('FIAT', 'Sedan'); 

CREATE TABLE agendamento(
	id_agendamento INT auto_increment primary key,
    agendado_em timestamp default current_timestamp,
    id_do_cliente INT NOT NULL,
    FOREIGN KEY (id_do_cliente) REFERENCES clientes(id_cliente)
);