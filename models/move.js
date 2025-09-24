"use strict";
const { Model } = require("sequelize");
module.exports = (sequelize, DataTypes) => {
  class Move extends Model {
    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      this.belongsTo(models.User, { as: "Player1", foreignKey: "User_id_1" });
      this.belongsTo(models.User, { as: "Player2", foreignKey: "User_id_2" });
      this.belongsTo(models.Room, { foreignKey: "Room_id" });
    }
  }
  Move.init(
    {
      Room_id: DataTypes.INTEGER,
      User_id_1: DataTypes.INTEGER,
      User_id_2: DataTypes.INTEGER,
      User_id_1_choice: DataTypes.STRING,
      User_id_2_choice: DataTypes.STRING,
      result: DataTypes.STRING,
    },
    {
      sequelize,
      modelName: "Move",
    }
  );
  return Move;
};
